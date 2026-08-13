import type { ArchivedIdentity, Change, MarkdownFile } from "./types.js";
export declare const ARCHIVE_DIR_NAME = "archive";
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
export declare function compareArtifacts(a: MarkdownFile, b: MarkdownFile): number;
export declare function scanChanges(changesDir: string): Promise<Change[]>;
/**
 * Splits `YYYY-MM-DD-<name>`. A missing or malformed prefix is not an error:
 * the whole directory name becomes the display name and no date is reported,
 * because the archive is user-owned and may hold hand-moved directories.
 */
export declare function parseArchivedDirName(dirName: string): ArchivedIdentity;
export declare function scanArchivedChanges(changesDir: string): Promise<Change[]>;
export declare function collectMarkdownFiles(dirPath: string, baseDir?: string): Promise<MarkdownFile[]>;
export declare function slugify(s: string): string;
//# sourceMappingURL=scanner.d.ts.map