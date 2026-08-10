export interface MarkdownFile {
    name: string;
    slug: string;
    filePath: string;
}
export interface Change {
    name: string;
    slug: string;
    dirPath: string;
    artifacts: MarkdownFile[];
}
export type TargetMode = {
    kind: "changes";
    changesDir: string;
} | {
    kind: "change";
    changeName: string;
    dirPath: string;
} | {
    kind: "dir";
    dirPath: string;
} | {
    kind: "file";
    filePath: string;
};
export interface ServerOptions {
    port: number;
    mode: TargetMode;
    openBrowser: boolean;
}
//# sourceMappingURL=types.d.ts.map