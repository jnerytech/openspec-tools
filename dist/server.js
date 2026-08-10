import { createServer } from "http";
import { execSync } from "child_process";
import { relative, sep } from "path";
import { derivePort, PORT_RANGE_START, PORT_RANGE_END, PORT_RANGE_SIZE, } from "./port.js";
import { scanChanges, scanArchivedChanges, collectMarkdownFiles, } from "./scanner.js";
import { renderIndex, renderChange, renderFiles, renderSingleFile, render404, } from "./renderer.js";
function send(res, status, html) {
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
function archiveView(url, initial) {
    const param = url.searchParams.get("archived");
    const current = param === null ? initial : param !== "0";
    return { current, initial };
}
async function handle(req, res, mode, initialArchived, project) {
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
            send(res, 200, renderIndex(project, changes, mode.changesDir, { view, archivedChanges }));
            return;
        }
        if (mode.kind === "archive") {
            const archivedChanges = await scanArchivedChanges(mode.changesDir);
            send(res, 200, renderIndex(project, [], mode.changesDir, {
                view,
                archivedChanges,
                archiveOnly: true,
            }));
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
    if (archivedMatch &&
        (mode.kind === "changes" || mode.kind === "archive")) {
        const slug = decodeURIComponent(archivedMatch[1]);
        const archivedChanges = await scanArchivedChanges(mode.changesDir);
        const change = archivedChanges.find((c) => c.slug === slug || c.name === slug);
        if (!change) {
            send(res, 404, render404(project));
            return;
        }
        send(res, 200, await renderChange(project, change, view));
        return;
    }
    send(res, 404, render404(project));
}
function openBrowserAt(url) {
    const cmd = process.platform === "darwin"
        ? `open "${url}"`
        : process.platform === "win32"
            ? `start "" "${url}"`
            : `xdg-open "${url}"`;
    try {
        execSync(cmd);
    }
    catch { /* ignore */ }
}
/** Automatic selection must not widen what the server is reachable from. */
const LOOPBACK = "127.0.0.1";
function fail(message, details = []) {
    console.error(`[openspec-tools] ${message}`);
    for (const line of details)
        console.error(line);
    process.exit(1);
}
function isAddressInUse(err) {
    return err?.code === "EADDRINUSE";
}
/** Why a bind failed, in the user's words rather than Node's. */
function bindFailureReason(err) {
    const { code, message } = (err ?? {});
    if (code === "EACCES")
        return "permission denied (ports below 1024 need privileges)";
    if (code === "EADDRNOTAVAIL")
        return `the address ${LOOPBACK} is not available`;
    return code ? `${code}` : message || "unknown error";
}
/**
 * One bind attempt. The `error` listener is attached before `listen`, so a
 * refused port resolves into a value here rather than reaching the default
 * uncaughtException path as a stack trace.
 */
function bind(server, port) {
    return new Promise((succeed, refuse) => {
        const onError = (err) => {
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
async function bindDerived(server, preferred) {
    for (let step = 0; step < PORT_RANGE_SIZE; step++) {
        const candidate = PORT_RANGE_START +
            ((preferred - PORT_RANGE_START + step) % PORT_RANGE_SIZE);
        try {
            await bind(server, candidate);
            return candidate;
        }
        catch (err) {
            if (!isAddressInUse(err)) {
                fail(`Could not listen on port ${candidate}: ${bindFailureReason(err)}.`);
            }
        }
    }
    return fail(`No free port between ${PORT_RANGE_START} and ${PORT_RANGE_END} — every port in the range is in use.`, [`  Supply one explicitly: opsx-read --port <n>`]);
}
async function bindRequested(server, port) {
    try {
        await bind(server, port);
        return port;
    }
    catch (err) {
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
function describeTarget(mode, project) {
    const within = (abs) => {
        const rel = relative(project.root, abs);
        return rel && !rel.startsWith("..") ? rel : abs;
    };
    switch (mode.kind) {
        case "changes":
            return `${within(mode.changesDir)}${sep}`;
        case "archive":
            return `${within(mode.changesDir)}${sep}archive${sep}`;
        case "change":
            return `change ${mode.archived?.displayName ?? mode.changeName}${mode.archived ? " (archived)" : ""}`;
        case "dir":
            return `${within(mode.dirPath)}${sep}`;
        case "file":
            return within(mode.filePath);
    }
}
export async function startServer(opts) {
    const { requestedPort, project, mode, openBrowser, archived } = opts;
    const server = createServer((req, res) => {
        handle(req, res, mode, archived, project.name).catch((err) => {
            console.error("[openspec-tools]", err);
            send(res, 500, `<pre style="padding:2rem">Error: ${String(err)}</pre>`);
        });
    });
    const derived = derivePort(project.root);
    const bound = requestedPort === undefined
        ? await bindDerived(server, derived)
        : await bindRequested(server, requestedPort);
    // A failure after the socket is up is still a message, not a stack trace.
    server.on("error", (err) => {
        fail(`Server error: ${bindFailureReason(err)}.`);
    });
    // Silence about a substitution would make the one promise this makes — the
    // same project is always at the same URL — look like it broke at random.
    if (requestedPort === undefined && bound !== derived) {
        console.warn(`[openspec-tools] Port ${derived} is in use — listening on ${bound} instead.`);
    }
    const url = `http://localhost:${bound}`;
    console.log(`\n  openspec-tools  →  ${url}\n` +
        `  project: ${project.name}  ·  reading: ${describeTarget(mode, project)}\n`);
    if (openBrowser)
        openBrowserAt(url);
    process.on("SIGINT", () => {
        server.close();
        process.exit(0);
    });
}
//# sourceMappingURL=server.js.map