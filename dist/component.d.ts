import type { ProjectIdentity } from "./types.js";
/**
 * What a component has in a project right now, derived from disk every time it
 * is asked for. `detail` carries what the component recorded about itself — the
 * language it set, which agreements are enabled — so a listing can say *which*
 * rather than only *whether*.
 */
export type ComponentState = {
    kind: "absent";
} | {
    kind: "provisioned";
    detail: string;
} | {
    kind: "differs";
    detail: string;
} | {
    kind: "unsafe";
    reason: string;
};
export declare function describeComponentState(state: ComponentState): string;
/**
 * A whole file or directory appearing or disappearing. The path says everything
 * that happens to it, which is why these need no diff.
 */
export interface PathEdit {
    kind: "path";
    action: "write" | "delete";
    path: string;
    /** Anything the confirmation must say beyond the path, such as local edits. */
    note?: string;
    /** Component-private payload; the generic layer never looks inside. */
    payload?: unknown;
}
/**
 * Lines changing inside a file that holds content this package did not write.
 * Whole contents are carried on both sides so applying is a single write and
 * the diff is derived rather than tracked. `null` on either side is the file
 * not existing: before `null` creates it, after `null` removes it.
 */
export interface RegionEdit {
    kind: "region";
    path: string;
    before: string | null;
    after: string | null;
}
export type Edit = PathEdit | RegionEdit;
export declare function editPath(edit: Edit): string;
/**
 * A provisionable unit. `plan` receives `null` for a component the user cleared,
 * which is what folds removal into the same call that provisions — there is no
 * second code path for undoing.
 */
export interface Component<S = unknown> {
    id: string;
    /** How the component is named in the selection and in help. */
    label: string;
    /** One line describing what provisioning it does, for help text. */
    summary: string;
    inspect(project: ProjectIdentity): ComponentState;
    /** Asked only for a component the user selected. */
    choose(project: ProjectIdentity, ctx: ChooseContext): Promise<S | null>;
    plan(project: ProjectIdentity, selection: S | null): Edit[];
    applyEdit(project: ProjectIdentity, edit: Edit): void;
}
/**
 * What a component needs to ask its own questions: the options already supplied
 * on the command line, and the same refusal a missing answer earns everywhere
 * else in this package.
 */
export interface ChooseContext {
    options: Record<string, unknown>;
    /** Fails naming the options that would have supplied the answer. */
    requireInteractive(missing: string, options: string[]): void;
}
/**
 * The changed hunk between two versions of a file. A region splice is
 * contiguous, so trimming the common prefix and suffix leaves exactly the lines
 * that moved — no diff algorithm and no dependency.
 */
export declare function lineDiff(before: string | null, after: string | null): {
    removed: string[];
    added: string[];
};
/**
 * Everything that would happen, named before any of it does. A path is enough
 * for a whole file or directory; an edit inside a file the user owns is shown
 * as a diff, because the path alone does not say what becomes of the rest.
 */
export declare function renderPlan(edits: Edit[]): string[];
/** Writing the whole file is the apply for every region edit, so both components share it. */
export declare function applyRegionEdit(edit: RegionEdit): void;
export interface PlanEntry<S = unknown> {
    component: Component<S>;
    edits: Edit[];
}
/**
 * Applies what was named and confirmed. A failure names the path involved
 * rather than the component, because the path is what the user has to go look
 * at, and stops rather than continuing into a half-applied state.
 */
export declare function applyPlan(project: ProjectIdentity, entries: PlanEntry[]): void;
//# sourceMappingURL=component.d.ts.map