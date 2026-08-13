import { createServer, IncomingMessage, ServerResponse, Server } from "http";
import { execSync } from "child_process";
import { relative, sep } from "path";
import { ExitError } from "./exit.js";
import type { ProjectIdentity, ServerOptions, TargetMode } from "./types.js";
import {
  derivePort,
  PORT_RANGE_START,
  PORT_RANGE_END,
  PORT_RANGE_SIZE,
} from "./port.js";
import {
  scanChanges,
  scanArchivedChanges,
  collectMarkdownFiles,
} from "./scanner.js";
import {
  renderIndex,
  renderChange,
  renderFiles,
  renderSingleFile,
  render404,
} from "./renderer.js";
import type { ArchiveViewState } from "./renderer.js";

function send(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

/**
 * The invocation sets the initial state; the query parameter carries the
 * current one. The server already re-scans per request, so revealing the
 * archive costs a reload rather than a restart.
 */
function archiveView(url: URL, initial: boolean): ArchiveViewState {
  const param = url.searchParams.get("archived");
  const current = param === null ? initial : param !== "0";
  return { current, initial };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  mode: TargetMode,
  initialArchived: boolean,
  project: string
): Promise<void> {
  // Coverage reason: Node sets `req.url` for every request that reaches a
  // handler; the fallback is for a shape the HTTP server does not deliver.
  /* node:coverage ignore next */
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  const view = archiveView(url, initialArchived);

  // ── Index / ──────────────────────────────────────────────
  if (pathname === "/" || pathname === "") {
    if (mode.kind === "changes") {
      const changes = await scanChanges(mode.changesDir);
      const archivedChanges = view.current
        ? await scanArchivedChanges(mode.changesDir)
        : [];
      send(
        res,
        200,
        renderIndex(project, changes, mode.changesDir, { view, archivedChanges })
      );
      return;
    }

    if (mode.kind === "archive") {
      const archivedChanges = await scanArchivedChanges(mode.changesDir);
      send(
        res,
        200,
        renderIndex(project, [], mode.changesDir, {
          view,
          archivedChanges,
          archiveOnly: true,
        })
      );
      return;
    }

    if (mode.kind === "change") {
      const files = await collectMarkdownFiles(mode.dirPath);
      const change = {
        name: mode.changeName,
        slug: mode.changeName,
        dirPath: mode.dirPath,
        artifacts: files,
        archived: mode.archived,
      };
      send(res, 200, await renderChange(project, change, view));
      return;
    }

    if (mode.kind === "dir") {
      const files = await collectMarkdownFiles(mode.dirPath);
      // Coverage reason: `split` always yields at least one element, so `pop`
      // cannot return undefined here.
      /* node:coverage ignore next */
      const title = mode.dirPath.split("/").pop() ?? mode.dirPath;
      send(res, 200, await renderFiles(project, files, title));
      return;
    }

    if (mode.kind === "file") {
      send(res, 200, await renderSingleFile(project, mode.filePath));
      return;
    }
  }

  // ── /change/:slug (only in "changes" mode) ───────────────
  const changeMatch = pathname.match(/^\/change\/([^/]+)$/);
  if (changeMatch && mode.kind === "changes") {
    const slug = decodeURIComponent(changeMatch[1]);
    const changes = await scanChanges(mode.changesDir);
    const change = changes.find((c) => c.slug === slug || c.name === slug);
    if (!change) {
      send(res, 404, render404(project));
      return;
    }
    send(res, 200, await renderChange(project, change, view));
    return;
  }

  // ── /archived/:slug ──────────────────────────────────────
  // Its own prefix, so an archived change and an open change with the same
  // display name never resolve to each other.
  const archivedMatch = pathname.match(/^\/archived\/([^/]+)$/);
  if (
    archivedMatch &&
    (mode.kind === "changes" || mode.kind === "archive")
  ) {
    const slug = decodeURIComponent(archivedMatch[1]);
    const archivedChanges = await scanArchivedChanges(mode.changesDir);
    const change = archivedChanges.find(
      (c) => c.slug === slug || c.name === slug
    );
    if (!change) {
      send(res, 404, render404(project));
      return;
    }
    send(res, 200, await renderChange(project, change, view));
    return;
  }

  send(res, 404, render404(project));
}

// Coverage reason: this hands a URL to whatever program the desktop uses to
// open one. Running it would open a browser on the machine running the tests,
// and two of its three branches belong to platforms this repository is not run
// on. `design.md` names opening a browser as a Non-Goal for the same reason.
/* node:coverage disable */
function openBrowserAt(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;
  try { execSync(cmd); } catch { /* ignore */ }
}
/* node:coverage enable */

/** Automatic selection must not widen what the server is reachable from. */
const LOOPBACK = "127.0.0.1";

/**
 * `sshd` sets SSH_CONNECTION to "<client-ip> <client-port> <server-ip>
 * <server-port>". The third field is the address the client already reached
 * this machine on, which beats enumerating interfaces: on a host with several,
 * there is no way to tell from the outside which one the user came in by.
 */
function remoteServerAddress(): string | undefined {
  const fields = (process.env.SSH_CONNECTION ?? "").trim().split(/\s+/);
  return fields[2] || undefined;
}

/**
 * Deliberately broader than `remoteServerAddress`: a session can be remote
 * while the address is unavailable, and a hint with a placeholder host still
 * carries the part the user cannot guess.
 */
function isRemoteSession(): boolean {
  return Boolean(
    process.env.SSH_CONNECTION || process.env.SSH_TTY || process.env.SSH_CLIENT
  );
}

/**
 * The non-obvious part is the `-L` mapping, not the user's own name or host,
 * so an unresolved piece degrades to a placeholder rather than suppressing the
 * whole line.
 */
function forwardingCommand(port: number): string {
  const user = process.env.USER || process.env.LOGNAME || "<user>";
  const host = remoteServerAddress() ?? "<host>";
  return `ssh -L ${port}:localhost:${port} ${user}@${host}`;
}

/**
 * Throws rather than exiting, so a failure to start is observable by the caller
 * — and by a test running in the same process — instead of taking the process
 * down from inside a helper.
 */
function fail(message: string, details: string[] = []): never {
  throw new ExitError(`[openspec-tools] ${message}`, details);
}

function isAddressInUse(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === "EADDRINUSE";
}

/**
 * Why a bind failed, in the user's words rather than Node's. Exported because
 * it is a pure mapping: the codes it names are not all reachable by actually
 * binding something, and the mapping is what has to be right.
 */
export function bindFailureReason(err: unknown): string {
  const { code, message } = (err ?? {}) as NodeJS.ErrnoException;
  if (code === "EACCES") return "permission denied (ports below 1024 need privileges)";
  if (code === "EADDRNOTAVAIL") return `the address ${LOOPBACK} is not available`;
  return code ? `${code}` : message || "unknown error";
}

/**
 * One bind attempt. The `error` listener is attached before `listen`, so a
 * refused port resolves into a value here rather than reaching the default
 * uncaughtException path as a stack trace.
 */
function bind(server: Server, port: number): Promise<void> {
  return new Promise((succeed, refuse) => {
    const onError = (err: Error) => {
      server.removeListener("listening", onListening);
      refuse(err);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      succeed();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, LOOPBACK);
  });
}

/**
 * A derived port that is busy is not an error: probe forward through the
 * range, wrapping, and settle on the first free one. Only a non-EADDRINUSE
 * failure stops the search — a different port will not fix a permissions
 * problem or a missing interface.
 */
async function bindDerived(server: Server, preferred: number): Promise<number> {
  for (let step = 0; step < PORT_RANGE_SIZE; step++) {
    const candidate =
      PORT_RANGE_START +
      ((preferred - PORT_RANGE_START + step) % PORT_RANGE_SIZE);
    try {
      await bind(server, candidate);
      return candidate;
    } catch (err) {
      // Coverage reason: everything from here to the end of this function is
      // about the range running out. A probe failing for anything but a busy
      // port needs the loopback interface itself to be broken, and reaching
      // the return below means holding all 758 ports at once — neither is
      // something a test can stage without breaking every other case.
      /* node:coverage disable */
      if (!isAddressInUse(err)) {
        fail(`Could not listen on port ${candidate}: ${bindFailureReason(err)}.`);
      }
    }
  }

  return fail(
    `No free port between ${PORT_RANGE_START} and ${PORT_RANGE_END} — every port in the range is in use.`,
    [`  Supply one explicitly: opsx-tools read --port <n>`]
  );
  /* node:coverage enable */
}

async function bindRequested(server: Server, port: number): Promise<number> {
  try {
    await bind(server, port);
    // What was actually bound, not what was asked for. The two differ only
    // when the request was port 0 — "any free port" — and announcing the
    // request there would print a URL that goes nowhere.
    const address = server.address();
    // Coverage reason: a TCP listener always reports an object address; the
    // string form belongs to a pipe or a socket file, which this never binds.
    /* node:coverage ignore next */
    return typeof address === "object" && address !== null ? address.port : port;
  } catch (err) {
    if (isAddressInUse(err)) {
      return fail(`Port ${port} is already in use.`, [
        `  Another process is holding it — stop it, or pass a different --port.`,
        `  Omitting --port lets the reader choose a free port for this project.`,
      ]);
    }
    return fail(`Could not listen on port ${port}: ${bindFailureReason(err)}.`);
  }
}

/** What is being read, said in the shortest form that still locates it. */
function describeTarget(mode: TargetMode, project: ProjectIdentity): string {
  const within = (abs: string): string => {
    const rel = relative(project.root, abs);
    return rel && !rel.startsWith("..") ? rel : abs;
  };

  switch (mode.kind) {
    case "changes":
      return `${within(mode.changesDir)}${sep}`;
    case "archive":
      return `${within(mode.changesDir)}${sep}archive${sep}`;
    case "change":
      return `change ${mode.archived?.displayName ?? mode.changeName}${
        mode.archived ? " (archived)" : ""
      }`;
    case "dir":
      return `${within(mode.dirPath)}${sep}`;
    case "file":
      return within(mode.filePath);
  }
}

/** A reader that is up: what it bound, and how to take it down again. */
export interface RunningReader {
  port: number;
  url: string;
  close(): Promise<void>;
}

export async function startServer(opts: ServerOptions): Promise<RunningReader> {
  const { requestedPort, project, mode, openBrowser, archived } = opts;

  const server = createServer((req, res) => {
    handle(req, res, mode, archived, project.name).catch((err) => {
      console.error("[openspec-tools]", err);
      send(res, 500, `<pre style="padding:2rem">Error: ${String(err)}</pre>`);
    });
  });

  const derived = derivePort(project.root);
  const bound =
    requestedPort === undefined
      ? await bindDerived(server, derived)
      : await bindRequested(server, requestedPort);

  // A failure after the socket is up is still a message, not a stack trace.
  // Reported and exited here rather than thrown: this runs from an event, so
  // there is no caller to catch it, and an exception would become exactly the
  // stack trace this exists to prevent.
  /* node:coverage disable */
  // Coverage reason: this fires only when the socket fails after it is up —
  // a condition a test cannot produce on a healthy loopback listener — and it
  // ends the process doing the measuring. What it says is `bindFailureReason`,
  // which is exercised directly.
  server.on("error", (err) => {
    console.error(`[openspec-tools] Server error: ${bindFailureReason(err)}.`);
    process.exit(1);
  });
  /* node:coverage enable */

  // Silence about a substitution would make the one promise this makes — the
  // same project is always at the same URL — look like it broke at random.
  if (requestedPort === undefined && bound !== derived) {
    console.warn(
      `[openspec-tools] Port ${derived} is in use — listening on ${bound} instead.`
    );
  }

  const url = `http://localhost:${bound}`;

  // Over a remote shell the URL above names this machine, while the browser
  // reading it resolves `localhost` to the user's own. Forwarding makes the URL
  // true from there — which is why the binding does not have to widen. The port
  // is the one bound, so a substitution above stays reflected here.
  const remoteHint = isRemoteSession()
    ? `\n  remote session — forward the port from the machine you are at:\n` +
      `    ${forwardingCommand(bound)}\n`
    : "";

  console.log(
    `\n  openspec-tools  →  ${url}\n` +
      `  project: ${project.name}  ·  reading: ${describeTarget(mode, project)}\n` +
      remoteHint
  );
  // Coverage reason: the true branch launches a browser on the machine running
  // the tests. `design.md` names opening a browser as a Non-Goal.
  /* node:coverage ignore next */
  if (openBrowser) openBrowserAt(url);

  // Registered here and removed on close, so a caller that starts and stops
  // several readers in one process does not accumulate handlers.
  // Coverage reason: this ends the process it runs in, which in a test run is
  // the process doing the measuring. Its removal on close is what is asserted
  // instead, and that is the part with a consequence.
  /* node:coverage ignore next 4 */
  const onInterrupt = (): void => {
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", onInterrupt);

  return {
    port: bound,
    url,
    close: () =>
      new Promise<void>((done) => {
        process.removeListener("SIGINT", onInterrupt);
        server.close(() => done());
      }),
  };
}
