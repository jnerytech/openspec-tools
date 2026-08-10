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
  date?: string;        // YYYY-MM-DD, from the directory name prefix
  displayName: string;  // directory name with that prefix stripped
}

export interface Change {
  name: string;
  slug: string;
  dirPath: string;
  artifacts: MarkdownFile[];
  archived?: ArchivedIdentity;
}

export type TargetMode =
  | { kind: "changes"; changesDir: string }   // openspec/changes/ (default)
  | { kind: "archive"; changesDir: string }   // openspec/changes/archive/
  | { kind: "change";  changeName: string; dirPath: string; archived?: ArchivedIdentity }
  | { kind: "dir";     dirPath: string }       // qualquer pasta com .md
  | { kind: "file";    filePath: string };     // arquivo .md específico

export interface ServerOptions {
  port: number;
  mode: TargetMode;
  openBrowser: boolean;
  /** Whether the first page load includes archived changes. */
  archived: boolean;
}
