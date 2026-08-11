import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { ProjectIdentity } from "./types.js";

/**
 * What a component has in a project right now, derived from disk every time it
 * is asked for. `detail` carries what the component recorded about itself — the
 * language it set, which agreements are enabled — so a listing can say *which*
 * rather than only *whether*.
 */
export type ComponentState =
  | { kind: "absent" }
  | { kind: "provisioned"; detail: string }
  | { kind: "differs"; detail: string }
  | { kind: "unsafe"; reason: string };

export function describeComponentState(state: ComponentState): string {
  switch (state.kind) {
    case "absent":
      return "not set";
    case "provisioned":
      return state.detail;
    case "differs":
      return `${state.detail} — differs from what this package writes`;
    case "unsafe":
      return `cannot be edited safely (${state.reason})`;
  }
}

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

export function editPath(edit: Edit): string {
  return edit.path;
}

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
export function lineDiff(
  before: string | null,
  after: string | null
): { removed: string[]; added: string[] } {
  // A file's terminating newline splits into a trailing empty element that is
  // not a line. Left in, it shows up as a phantom blank in every diff.
  const split = (text: string | null): string[] => {
    if (!text) return [];
    const lines = text.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    return lines;
  };

  const a = split(before);
  const b = split(after);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  return { removed: a.slice(start, endA), added: b.slice(start, endB) };
}

/**
 * Everything that would happen, named before any of it does. A path is enough
 * for a whole file or directory; an edit inside a file the user owns is shown
 * as a diff, because the path alone does not say what becomes of the rest.
 */
export function renderPlan(edits: Edit[]): string[] {
  const lines: string[] = [];

  const writes = edits.filter(
    (e): e is PathEdit => e.kind === "path" && e.action === "write"
  );
  const deletes = edits.filter(
    (e): e is PathEdit => e.kind === "path" && e.action === "delete"
  );
  const regions = edits.filter((e): e is RegionEdit => e.kind === "region");

  if (writes.length > 0) {
    lines.push("Will be written:");
    for (const edit of writes) {
      lines.push(`  ${edit.path}${edit.note ? `   (${edit.note})` : ""}`);
    }
    lines.push("");
  }

  if (deletes.length > 0) {
    lines.push("Will be deleted:");
    for (const edit of deletes) {
      lines.push(`  ${edit.path}${edit.note ? `   (${edit.note})` : ""}`);
    }
    lines.push("");
  }

  for (const edit of regions) {
    const { removed, added } = lineDiff(edit.before, edit.after);
    const what =
      edit.before === null
        ? " (new file)"
        : edit.after === null
        ? " (file removed)"
        : "";
    lines.push(`${edit.path}${what}`);
    for (const line of removed) lines.push(`  - ${line}`);
    for (const line of added) lines.push(`  + ${line}`);
    lines.push("");
  }

  return lines;
}

/** Writing the whole file is the apply for every region edit, so both components share it. */
export function applyRegionEdit(edit: RegionEdit): void {
  if (edit.after === null) {
    rmSync(edit.path, { force: true });
    return;
  }
  mkdirSync(dirname(edit.path), { recursive: true });
  writeFileSync(edit.path, edit.after);
}

export interface PlanEntry<S = unknown> {
  component: Component<S>;
  edits: Edit[];
}

/**
 * Applies what was named and confirmed. A failure names the path involved
 * rather than the component, because the path is what the user has to go look
 * at, and stops rather than continuing into a half-applied state.
 */
export function applyPlan(
  project: ProjectIdentity,
  entries: PlanEntry[]
): never | void {
  for (const { component, edits } of entries) {
    for (const edit of edits) {
      try {
        component.applyEdit(project, edit);
      } catch (err) {
        console.error(
          `[openspec-tools] Could not complete the change to ${editPath(edit)}: ${
            (err as Error).message
          }`
        );
        process.exit(1);
      }
    }
  }
}
