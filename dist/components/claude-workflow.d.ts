import type { Component } from "../component.js";
import type { ProjectIdentity } from "../types.js";
export interface WorkflowSelection {
    keys: string[];
}
export declare function claudeMdPath(project: ProjectIdentity): string;
export declare const claudeWorkflowComponent: Component<WorkflowSelection>;
//# sourceMappingURL=claude-workflow.d.ts.map