import type { MarkdownFile } from "./types.js";
export declare function renderIndex(changes: import("./types.js").Change[], mode: string): string;
export declare function renderChange(change: import("./types.js").Change): Promise<string>;
export declare function renderFiles(files: MarkdownFile[], title: string, backHref?: string): Promise<string>;
export declare function renderSingleFile(filePath: string): Promise<string>;
export declare function render404(): string;
//# sourceMappingURL=renderer.d.ts.map