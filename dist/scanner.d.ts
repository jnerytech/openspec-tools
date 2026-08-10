import type { Change, MarkdownFile } from "./types.js";
export declare function scanChanges(changesDir: string): Promise<Change[]>;
export declare function collectMarkdownFiles(dirPath: string, baseDir?: string): Promise<MarkdownFile[]>;
export declare function slugify(s: string): string;
//# sourceMappingURL=scanner.d.ts.map