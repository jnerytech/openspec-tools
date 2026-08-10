export interface MarkdownFile {
    name: string;
    slug: string;
    filePath: string;
}
/**
 * What an archived directory name says about the change. Its presence is what
 * makes a Change archived — `date` is absent when the directory name carries
 * no valid `YYYY-MM-DD-` prefix, which is allowed.
 */
export interface ArchivedIdentity {
    date?: string;
    displayName: string;
}
export interface Change {
    name: string;
    slug: string;
    dirPath: string;
    artifacts: MarkdownFile[];
    archived?: ArchivedIdentity;
}
export type TargetMode = {
    kind: "changes";
    changesDir: string;
} | {
    kind: "archive";
    changesDir: string;
} | {
    kind: "change";
    changeName: string;
    dirPath: string;
    archived?: ArchivedIdentity;
} | {
    kind: "dir";
    dirPath: string;
} | {
    kind: "file";
    filePath: string;
};
/**
 * The project being served, resolved once. `root` decides the port and `name`
 * is how the user tells one running reader from another.
 */
export interface ProjectIdentity {
    /** Absolute path of the project root, symlinks resolved. */
    root: string;
    /** The root's basename. */
    name: string;
}
export interface ServerOptions {
    /** What the user asked for. Absent means the reader derives a port itself. */
    requestedPort?: number;
    project: ProjectIdentity;
    mode: TargetMode;
    openBrowser: boolean;
    /** Whether the first page load includes archived changes. */
    archived: boolean;
}
//# sourceMappingURL=types.d.ts.map