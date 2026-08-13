import { resolve } from "path";
import { checkbox } from "@inquirer/prompts";
import { applyRegionEdit } from "../component.js";
import { findMarkdownRegion, isBlank, markdownWithRegion, readFileOrNull, } from "../region-markdown.js";
const ID = "claude-workflow";
/** Claude Code reads this one; the cross-tool files deliberately do not get it. */
const FILE = "CLAUDE.md";
const AGREEMENTS = [
    {
        key: "todos",
        label: "keep a task list",
        line: "- Track the work with the todo tool, keeping it current as steps finish.",
    },
    {
        key: "questions",
        label: "ask rather than assume",
        line: "- When a decision is ambiguous, ask with the question tool instead of assuming.",
    },
];
export function claudeMdPath(project) {
    return resolve(project.root, FILE);
}
function enabledFrom(params) {
    return AGREEMENTS.filter((a) => params[a.key] === "on").map((a) => a.key);
}
function paramsFor(keys) {
    const params = {};
    for (const agreement of AGREEMENTS) {
        params[agreement.key] = keys.includes(agreement.key) ? "on" : "off";
    }
    return params;
}
/** Scoped in its own text, so it never claims work outside `openspec/`. */
function directive(keys) {
    return [
        "## Working on OpenSpec files",
        "",
        "When the work touches files under `openspec/`:",
        "",
        ...AGREEMENTS.filter((a) => keys.includes(a.key)).map((a) => a.line),
    ];
}
function describe(keys) {
    const names = AGREEMENTS.filter((a) => keys.includes(a.key)).map((a) => a.label);
    return names.length === 0 ? "none enabled" : names.join(", ");
}
export const claudeWorkflowComponent = {
    id: "claude-workflow",
    label: "Claude Code working agreements",
    summary: "directives for how Claude Code works on files under openspec/",
    inspect(project) {
        const content = readFileOrNull(claudeMdPath(project));
        const found = findMarkdownRegion(content, ID);
        if (found.kind === "damaged")
            return { kind: "unsafe", reason: found.reason };
        if (found.kind === "absent")
            return { kind: "absent" };
        const keys = enabledFrom(found.params);
        const expected = directive(keys);
        const matches = found.body.length === expected.length &&
            found.body.every((line, i) => line === expected[i]);
        return matches
            ? { kind: "provisioned", detail: describe(keys) }
            : { kind: "differs", detail: describe(keys) };
    },
    async choose(project, ctx) {
        const supplied = AGREEMENTS.filter((a) => ctx.options[a.key] === true);
        if (supplied.length > 0)
            return { keys: supplied.map((a) => a.key) };
        ctx.requireInteractive("Which working agreements to write", [
            ...AGREEMENTS.map((a) => `--${a.key}   ${a.label}`),
        ]);
        const current = enabledFrom((() => {
            const found = findMarkdownRegion(readFileOrNull(claudeMdPath(project)), ID);
            return found.kind === "found" ? found.params : {};
        })());
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
        if (found.kind === "damaged")
            return [];
        const createdByUs = found.kind === "found"
            ? found.params.created === "1"
            : before === null;
        const keys = selection?.keys ?? [];
        const params = { ...paramsFor(keys), created: createdByUs ? "1" : "0" };
        const content = markdownWithRegion(before, ID, params, selection === null ? null : directive(keys));
        // A file this package brought into existence goes out with the region it
        // was created for. One the user already had is kept, empty or not — it is
        // theirs, and emptiness is not permission to delete it.
        const after = selection === null && createdByUs && isBlank(content) ? null : content;
        if (before === after)
            return [];
        const edit = { kind: "region", path, before, after };
        return [edit];
    },
    applyEdit(_project, edit) {
        if (edit.kind === "region")
            applyRegionEdit(edit);
    },
};
//# sourceMappingURL=claude-workflow.js.map