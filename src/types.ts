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

/** A skill the package ships, named by its directory — which is its `/command`. */
export interface PackagedSkill {
  name: string;
  /** Absolute path inside the installed package. */
  path: string;
}

export type DestinationId = "project" | "user";

/** Somewhere a skill may be installed, always carrying the path it writes. */
export interface Destination {
  id: DestinationId;
  /** How the destination is named to the user. */
  label: string;
  /** Absolute path of the `.claude/skills/` directory itself. */
  skillsDir: string;
}

/**
 * What is at a destination for one packaged skill, derived by comparison every
 * time it is asked for. No install writes a record, so a skill copied into
 * place by hand is classified exactly like one the installer placed.
 */
export type SkillState =
  | { kind: "absent" }
  | { kind: "identical" }
  | { kind: "differs" }
  | { kind: "unreadable"; reason: string };

export interface ServerOptions {
  /** What the user asked for. Absent means the reader derives a port itself. */
  requestedPort?: number;
  project: ProjectIdentity;
  mode: TargetMode;
  openBrowser: boolean;
  /** Whether the first page load includes archived changes. */
  archived: boolean;
}
