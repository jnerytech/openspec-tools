import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { applyRegionEdit } from "../component.js";
import { findMarkdownRegion, isBlank, markdownWithRegion, readFileOrNull, } from "../region-markdown.js";
const ID = "commit-convention";
/**
 * One rule file per topic is the convention the directory is read under, and the
 * name describes the topic rather than this package: the marker inside is what
 * identifies the lines as ours, so the filename does not have to.
 */
const FILE = [".claude", "rules", "commit-convention.md"];
/**
 * Said out loud for the same reason the skills directory says it: a rules
 * directory that did not exist when the tool started is only read after it
 * restarts, so a correct write would otherwise look like it did nothing.
 */
const RESTART_CAVEAT = "A rules directory that did not exist when your AI tool started is only " +
    "detected after the tool is restarted.";
/**
 * The rule, written without frontmatter — `paths` is the only field that would
 * apply here, and it scopes a rule to reading a matching file, which is not what
 * writing a commit message is. No field means it loads every session, which is
 * when the message gets written.
 *
 * The last bullet is the point of the whole rule: the agent's own default
 * instruction produces a body and a `Co-Authored-By` trailer, and a rule that
 * does not contradict that in writing changes nothing.
 */
const RULE = [
    "## Commit messages",
    "",
    "Every commit message is exactly one line, in Conventional Commits form:",
    "",
    "    type(scope): description",
    "",
    "- `type` is one of: feat, fix, docs, style, refactor, perf, test, build,",
    "  ci, chore, revert.",
    "- `scope` is optional and names the area touched, in lowercase.",
    "- Mark a breaking change with `!` before the colon: `feat(cli)!: ...`.",
    "- The description is imperative and lowercase, with no trailing period.",
    "- Keep the whole line at 72 characters or fewer.",
    "- Write nothing after that line: no body, no footer, no trailers — in",
    "  particular no `Co-Authored-By` line.",
];
export function commitRulePath(project) {
    return resolve(project.root, ...FILE);
}
export const commitConventionComponent = {
    id: ID,
    label: "Commit convention rule",
    summary: "a Claude Code rule asking for one-line conventional commits (an instruction, not a check)",
    inspect(project) {
        const content = readFileOrNull(commitRulePath(project));
        const found = findMarkdownRegion(content, ID);
        if (found.kind === "damaged")
            return { kind: "unsafe", reason: found.reason };
        if (found.kind === "absent")
            return { kind: "absent" };
        const matches = found.body.length === RULE.length &&
            found.body.every((line, i) => line === RULE[i]);
        return matches
            ? { kind: "provisioned", detail: "one-line conventional commits" }
            : { kind: "differs", detail: "one-line conventional commits" };
    },
    // Nothing to choose: one rule, one text, one destination. Which is what makes
    // the two flags enough to drive it without a terminal.
    async choose() {
        return {};
    },
    plan(project, selection) {
        const path = commitRulePath(project);
        const before = readFileOrNull(path);
        const found = findMarkdownRegion(before, ID);
        if (found.kind === "damaged")
            return [];
        const createdByUs = found.kind === "found" ? found.params.created === "1" : before === null;
        const content = markdownWithRegion(before, ID, { created: createdByUs ? "1" : "0" }, selection === null ? null : RULE);
        // A file this package brought into existence goes out with the rule it was
        // created for. One the user already had is kept, empty or not — the rest of
        // `.claude/rules/` is theirs, and so is this file.
        const after = selection === null && createdByUs && isBlank(content) ? null : content;
        if (before === after)
            return [];
        const edit = { kind: "region", path, before, after };
        return [edit];
    },
    applyEdit(_project, edit) {
        if (edit.kind !== "region")
            return;
        // Only ever the directory this file sits in: removing a rule is not
        // permission to remove the directory that may hold somebody else's.
        const created = edit.after !== null && !existsSync(dirname(edit.path));
        applyRegionEdit(edit);
        if (created) {
            console.log(`  created ${dirname(edit.path)}`);
            console.log(`  ${RESTART_CAVEAT}`);
        }
    },
};
//# sourceMappingURL=commit-convention.js.map