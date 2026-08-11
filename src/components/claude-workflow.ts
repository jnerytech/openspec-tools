import { resolve } from "path";
import { checkbox } from "@inquirer/prompts";
import type { Component, Edit, RegionEdit } from "../component.js";
import { applyRegionEdit } from "../component.js";
import {
  findMarkdownRegion,
  isBlank,
  markdownWithRegion,
  readFileOrNull,
} from "../region-markdown.js";
import type { ProjectIdentity } from "../types.js";

const ID = "claude-workflow";

/** Claude Code reads this one; the cross-tool files deliberately do not get it. */
const FILE = "CLAUDE.md";

/**
 * Each agreement is one directive the user switches on its own. Both are
 * instructions given to the agent — the package writes them, and makes no
 * claim about what the agent does next.
 */
interface Agreement {
  key: string;
  label: string;
  line: string;
}

const AGREEMENTS: Agreement[] = [
  {
    key: "todos",
    label: "keep a task list",
    line:
      "- Track the work with the todo tool, keeping it current as steps finish.",
  },
  {
    key: "questions",
    label: "ask rather than assume",
    line:
      "- When a decision is ambiguous, ask with the question tool instead of assuming.",
  },
];

export interface WorkflowSelection {
  keys: string[];
}

export function claudeMdPath(project: ProjectIdentity): string {
  return resolve(project.root, FILE);
}

function enabledFrom(params: Record<string, string>): string[] {
  return AGREEMENTS.filter((a) => params[a.key] === "on").map((a) => a.key);
}

function paramsFor(keys: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const agreement of AGREEMENTS) {
    params[agreement.key] = keys.includes(agreement.key) ? "on" : "off";
  }
  return params;
}

/** Scoped in its own text, so it never claims work outside `openspec/`. */
function directive(keys: string[]): string[] {
  return [
    "## Working on OpenSpec files",
    "",
    "When the work touches files under `openspec/`:",
    "",
    ...AGREEMENTS.filter((a) => keys.includes(a.key)).map((a) => a.line),
  ];
}

function describe(keys: string[]): string {
  const names = AGREEMENTS.filter((a) => keys.includes(a.key)).map((a) => a.label);
  return names.length === 0 ? "none enabled" : names.join(", ");
}

export const claudeWorkflowComponent: Component<WorkflowSelection> = {
  id: "claude-workflow",
  label: "Claude Code working agreements",
  summary: "directives for how Claude Code works on files under openspec/",

  inspect(project) {
    const content = readFileOrNull(claudeMdPath(project));
    const found = findMarkdownRegion(content, ID);

    if (found.kind === "damaged") return { kind: "unsafe", reason: found.reason };
    if (found.kind === "absent") return { kind: "absent" };

    const keys = enabledFrom(found.params);
    const expected = directive(keys);
    const matches =
      found.body.length === expected.length &&
      found.body.every((line, i) => line === expected[i]);

    return matches
      ? { kind: "provisioned", detail: describe(keys) }
      : { kind: "differs", detail: describe(keys) };
  },

  async choose(project, ctx) {
    const supplied = AGREEMENTS.filter((a) => ctx.options[a.key] === true);
    if (supplied.length > 0) return { keys: supplied.map((a) => a.key) };

    ctx.requireInteractive("Which working agreements to write", [
      ...AGREEMENTS.map((a) => `--${a.key}   ${a.label}`),
    ]);

    const current = enabledFrom(
      (() => {
        const found = findMarkdownRegion(
          readFileOrNull(claudeMdPath(project)),
          ID
        );
        return found.kind === "found" ? found.params : {};
      })()
    );

    const keys = await checkbox({
      message: "Which working agreements should be written?",
      choices: AGREEMENTS.map((a) => ({
        name: a.label,
        value: a.key,
        checked: current.length > 0 ? current.includes(a.key) : true,
      })),
    });

    // Neither agreement selected is the same request as clearing the row.
    return keys.length > 0 ? { keys } : null;
  },

  plan(project, selection) {
    const path = claudeMdPath(project);
    const before = readFileOrNull(path);

    const found = findMarkdownRegion(before, ID);
    if (found.kind === "damaged") return [];

    const createdByUs =
      found.kind === "found"
        ? found.params.created === "1"
        : before === null;

    const keys = selection?.keys ?? [];
    const params = { ...paramsFor(keys), created: createdByUs ? "1" : "0" };

    const content = markdownWithRegion(
      before,
      ID,
      params,
      selection === null ? null : directive(keys)
    );

    // A file this package brought into existence goes out with the region it
    // was created for. One the user already had is kept, empty or not — it is
    // theirs, and emptiness is not permission to delete it.
    const after =
      selection === null && createdByUs && isBlank(content) ? null : content;

    if (before === after) return [];
    if (before !== null && after !== null && before === after) return [];

    const edit: RegionEdit = { kind: "region", path, before, after };
    return [edit];
  },

  applyEdit(_project, edit: Edit) {
    if (edit.kind === "region") applyRegionEdit(edit);
  },
};
