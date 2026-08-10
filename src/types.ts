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

export type TargetMode =
  | { kind: "changes"; changesDir: string }   // openspec/changes/ (default)
  | { kind: "change";  changeName: string; dirPath: string }  // change específica
  | { kind: "dir";     dirPath: string }       // qualquer pasta com .md
  | { kind: "file";    filePath: string };     // arquivo .md específico

export interface ServerOptions {
  port: number;
  mode: TargetMode;
  openBrowser: boolean;
}
