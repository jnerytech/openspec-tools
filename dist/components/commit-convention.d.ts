import type { Component } from "../component.js";
import type { ProjectIdentity } from "../types.js";
/** The component has nothing to ask, so its selection carries nothing. */
export type CommitConventionSelection = Record<string, never>;
export declare function commitRulePath(project: ProjectIdentity): string;
export declare const commitConventionComponent: Component<CommitConventionSelection>;
//# sourceMappingURL=commit-convention.d.ts.map