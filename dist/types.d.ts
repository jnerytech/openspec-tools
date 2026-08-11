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
 * Which rule selected the project root. Reading and skill management care only
 * about the root itself, but provisioning turns on the distinction: a root that
 * won by holding `.git` is not an OpenSpec project, and the two are otherwise
 * indistinguishable in the returned value.
 */
export type ProjectSource = "openspec" | "git" | "cwd";
/**
 * The project being served, resolved once. `root` decides the port and `name`
 * is how the user tells one running reader from another.
 */
export interface ProjectIdentity {
    /** Absolute path of the project root, symlinks resolved. */
    root: string;
    /** The root's basename. */
    name: string;
    /** Why this root, and not a different one, was chosen. */
    source: ProjectSource;
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
export type SkillState = {
    kind: "absent";
} | {
    kind: "identical";
} | {
    kind: "differs";
} | {
    kind: "unreadable";
    reason: string;
};
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