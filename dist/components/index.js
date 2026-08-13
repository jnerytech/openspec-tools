import { artifactLanguageComponent } from "./artifact-language.js";
import { claudeWorkflowComponent } from "./claude-workflow.js";
import { commitConventionComponent } from "./commit-convention.js";
import { skillsComponent } from "./skills.js";
/**
 * Every component `init` offers, in the order it presents them: what the
 * package ships first, then what it configures. The list is closed and compiled
 * in — it exists to keep a second and third component cheap, not to accept one
 * from outside, which is what keeps `init` unable to write somewhere nobody
 * reviewed.
 */
export const COMPONENTS = [
    skillsComponent,
    artifactLanguageComponent,
    claudeWorkflowComponent,
    commitConventionComponent,
];
export function componentById(id) {
    return COMPONENTS.find((component) => component.id === id);
}
//# sourceMappingURL=index.js.map