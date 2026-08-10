import type { ProjectIdentity } from "./types.js";
/**
 * Which project the reader is serving, independent of the subdirectory the
 * command was run from. An `openspec/` owner wins over a repository root: a
 * repository may hold several specs directories, and the specs are what is
 * being read.
 */
export declare function resolveProject(cwd?: string): ProjectIdentity;
//# sourceMappingURL=project.d.ts.map