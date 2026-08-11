import type { Component } from "../component.js";
import type { ProjectIdentity } from "../types.js";
export interface LanguageSelection {
    lang: string;
}
/** The config file OpenSpec would read, or null when the project has none. */
export declare function configPath(project: ProjectIdentity): string | null;
export declare const artifactLanguageComponent: Component<LanguageSelection>;
/** Named so `init` can explain why this component offered nothing to do. */
export declare function missingConfigReason(project: ProjectIdentity): string | null;
//# sourceMappingURL=artifact-language.d.ts.map