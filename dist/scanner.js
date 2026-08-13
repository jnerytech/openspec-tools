import { readdir } from "fs/promises";
import { existsSync } from "fs";
import { join, extname, basename, relative } from "path";
/**
 * Reading order, not authoring order: orientation first, then why, the
 * contract, how, the work, and review last as commentary on all of it. A delta
 * spec lives at `specs/<capability>/spec.md`, so its artifact name is the
 * singular `spec` - the plural never matched and sank every contract below the
 * task list.
 */
const ARTIFACT_ORDER = [
    "summary",
    "proposal",
    "spec",
    "design",
    "tasks",
    "review",
];
export const ARCHIVE_DIR_NAME = "archive";
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
function artifactSortKey(name) {
    const idx = ARTIFACT_ORDER.indexOf(name.toLowerCase());
    return idx === -1 ? 99 : idx;
}
/**
 * Shared by open and archived changes so the two orderings cannot drift apart.
 * Artifacts of equal rank - several spec files, or several artifacts the order
 * does not name - fall back to the slug, which encodes the path relative to the
 * change and is therefore unique within it and independent of readdir order.
 *
 * Exported because the renderer applies it too: a route that builds a change
 * without scanning it - the reader pointed straight at one change - reached the
 * page with the directory's own order, and the guarantee has to live where the
 * page is built, not only where changes are discovered.
 */
export function compareArtifacts(a, b) {
    const byRank = artifactSortKey(a.name) - artifactSortKey(b.name);
    return byRank !== 0 ? byRank : a.slug.localeCompare(b.slug);
}
export async function scanChanges(changesDir) {
    if (!existsSync(changesDir))
        return [];
    const entries = await readdir(changesDir, { withFileTypes: true });
    const changes = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === ARCHIVE_DIR_NAME)
            continue;
        const dirPath = join(changesDir, entry.name);
        const artifacts = await collectMarkdownFiles(dirPath);
        if (artifacts.length > 0) {
            changes.push({
                name: entry.name,
                slug: slugify(entry.name),
                dirPath,
                artifacts: artifacts.sort(compareArtifacts),
            });
        }
    }
    return changes.sort((a, b) => a.name.localeCompare(b.name));
}
/**
 * Splits `YYYY-MM-DD-<name>`. A missing or malformed prefix is not an error:
 * the whole directory name becomes the display name and no date is reported,
 * because the archive is user-owned and may hold hand-moved directories.
 */
export function parseArchivedDirName(dirName) {
    const match = DATE_PREFIX.exec(dirName);
    if (!match)
        return { displayName: dirName };
    const [, date, rest] = match;
    if (!isCalendarDate(date))
        return { displayName: dirName };
    return { date, displayName: rest };
}
/** Rejects shapes like 2026-13-45 that match the pattern but are not dates. */
function isCalendarDate(value) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (!Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value);
}
export async function scanArchivedChanges(changesDir) {
    const archiveDir = join(changesDir, ARCHIVE_DIR_NAME);
    if (!existsSync(archiveDir))
        return [];
    const entries = await readdir(archiveDir, { withFileTypes: true });
    const changes = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const dirPath = join(archiveDir, entry.name);
        const artifacts = await collectMarkdownFiles(dirPath);
        if (artifacts.length === 0)
            continue;
        changes.push({
            name: entry.name,
            // Slug comes from the full directory name, so two archived changes that
            // share a base name stay distinct.
            slug: slugify(entry.name),
            dirPath,
            artifacts: artifacts.sort(compareArtifacts),
            archived: parseArchivedDirName(entry.name),
        });
    }
    // Newest first; undated entries last, ordered by name so repeated scans of
    // an unchanged archive agree regardless of readdir order.
    return changes.sort((a, b) => {
        const dateA = a.archived?.date;
        const dateB = b.archived?.date;
        if (dateA && dateB && dateA !== dateB)
            return dateB.localeCompare(dateA);
        if (dateA && !dateB)
            return -1;
        if (!dateA && dateB)
            return 1;
        return a.name.localeCompare(b.name);
    });
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