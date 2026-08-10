import { readdir } from "fs/promises";
import { existsSync } from "fs";
import { join, extname, basename, relative } from "path";
const ARTIFACT_ORDER = ["proposal", "specs", "design", "tasks", "review"];
function artifactSortKey(name) {
    const idx = ARTIFACT_ORDER.indexOf(name.toLowerCase());
    return idx === -1 ? 99 : idx;
}
export async function scanChanges(changesDir) {
    if (!existsSync(changesDir))
        return [];
    const entries = await readdir(changesDir, { withFileTypes: true });
    const changes = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "archive")
            continue;
        const dirPath = join(changesDir, entry.name);
        const artifacts = await collectMarkdownFiles(dirPath);
        if (artifacts.length > 0) {
            changes.push({
                name: entry.name,
                slug: slugify(entry.name),
                dirPath,
                artifacts: artifacts.sort((a, b) => artifactSortKey(a.name) - artifactSortKey(b.name)),
            });
        }
    }
    return changes.sort((a, b) => a.name.localeCompare(b.name));
}
export async function collectMarkdownFiles(dirPath, baseDir) {
    if (!existsSync(dirPath))
        return [];
    const base = baseDir ?? dirPath;
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isFile() && extname(entry.name) === ".md") {
            const rel = relative(base, fullPath);
            files.push({
                name: basename(entry.name, ".md"),
                slug: slugify(rel),
                filePath: fullPath,
            });
        }
        else if (entry.isDirectory()) {
            const sub = await collectMarkdownFiles(fullPath, base);
            files.push(...sub);
        }
    }
    return files;
}
export function slugify(s) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
//# sourceMappingURL=scanner.js.map