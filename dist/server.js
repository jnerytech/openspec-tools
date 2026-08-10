import { createServer } from "http";
import { execSync } from "child_process";
import { scanChanges, collectMarkdownFiles } from "./scanner.js";
import { renderIndex, renderChange, renderFiles, renderSingleFile, render404, } from "./renderer.js";
function send(res, status, html) {
    res.writeHead(status, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
    });
    res.end(html);
}
async function handle(req, res, mode) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;
    // ── Index / ──────────────────────────────────────────────
    if (pathname === "/" || pathname === "") {
        if (mode.kind === "changes") {
            const changes = await scanChanges(mode.changesDir);
            send(res, 200, renderIndex(changes, mode.changesDir));
            return;
        }
        if (mode.kind === "change") {
            const files = await collectMarkdownFiles(mode.dirPath);
            const change = {
                name: mode.changeName,
                slug: mode.changeName,
                dirPath: mode.dirPath,
                artifacts: files,
            };
            send(res, 200, await renderChange(change));
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
        send(res, 200, await renderChange(change));
        return;
    }
    send(res, 404, render404());
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
export function startServer(opts) {
    const { port, mode, openBrowser } = opts;
    const server = createServer((req, res) => {
        handle(req, res, mode).catch((err) => {
            console.error("[openspec-tools]", err);
            send(res, 500, `<pre style="padding:2rem">Error: ${String(err)}</pre>`);
        });
    });
    server.listen(port, "127.0.0.1", () => {
        const url = `http://localhost:${port}`;
        console.log(`\n  openspec-tools  →  ${url}\n`);
        if (openBrowser)
            openBrowserAt(url);
    });
    process.on("SIGINT", () => {
        server.close();
        process.exit(0);
    });
}
//# sourceMappingURL=server.js.map