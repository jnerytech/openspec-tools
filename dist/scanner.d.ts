import type { ArchivedIdentity, Change, MarkdownFile } from "./types.js";
export declare const ARCHIVE_DIR_NAME = "archive";
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