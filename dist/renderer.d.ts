import type { Change, MarkdownFile } from "./types.js";
/**
 * Whether archived changes are currently shown, and what the invocation asked
 * for. Links only carry the query parameter when the two differ, so a default
 * run keeps clean URLs while a revealed archive survives navigation.
 */
export interface ArchiveViewState {
    current: boolean;
    initial: boolean;
}
export declare function renderIndex(changes: Change[], changesDir: string, options?: {
    view?: ArchiveViewState;
    archivedChanges?: Change[];
    /** Archive directory targeted directly: no open-change section at all. */
    archiveOnly?: boolean;
}): string;
export declare function renderChange(change: Change, view?: ArchiveViewState): Promise<string>;
export declare function renderFiles(files: MarkdownFile[], title: string, backHref?: string): Promise<string>;
export declare function renderSingleFile(filePath: string): Promise<string>;
export declare function render404(): string;
//# sourceMappingURL=renderer.d.ts.map