import { createServer, IncomingMessage, ServerResponse } from "http";
import { execSync } from "child_process";
import type { ServerOptions, TargetMode } from "./types.js";
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
  initialArchived: boolean
): Promise<void> {
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
        renderIndex(changes, mode.changesDir, { view, archivedChanges })
      );
      return;
    }

    if (mode.kind === "archive") {
      const archivedChanges = await scanArchivedChanges(mode.changesDir);
      send(
        res,
        200,
        renderIndex([], mode.changesDir, {
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
      send(res, 200, await renderChange(change, view));
      return;
    }

    if (mode.kind === "dir") {
      const files = await collectMarkdownFiles(mode.dirPath);
      const title = mode.dirPath.split("/").pop() ?? mode.dirPath;
      send(res, 200, await renderFiles(files, title));
      return;
    }

    if (mode.kind === "file") {
      send(res, 200, await renderSingleFile(mode.filePath));
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
      send(res, 404, render404());
      return;
    }
    send(res, 200, await renderChange(change, view));
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
      send(res, 404, render404());
      return;
    }
    send(res, 200, await renderChange(change, view));
    return;
  }

  send(res, 404, render404());
}

function openBrowserAt(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;
  try { execSync(cmd); } catch { /* ignore */ }
}

export function startServer(opts: ServerOptions): void {
  const { port, mode, openBrowser, archived } = opts;

  const server = createServer((req, res) => {
    handle(req, res, mode, archived).catch((err) => {
      console.error("[openspec-tools]", err);
      send(res, 500, `<pre style="padding:2rem">Error: ${String(err)}</pre>`);
    });
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}`;
    console.log(`\n  openspec-tools  →  ${url}\n`);
    if (openBrowser) openBrowserAt(url);
  });

  process.on("SIGINT", () => {
    server.close();
    process.exit(0);
  });
}
