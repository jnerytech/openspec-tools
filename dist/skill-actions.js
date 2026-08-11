import { cpSync, rmSync } from "fs";
import { RESTART_CAVEAT, ensureSkillsDir, installedPath, } from "./skill-destinations.js";
import { describeState, skillState } from "./skill-state.js";
export const ALWAYS_YES = async () => true;
export function assign(skills, dests) {
    const pairs = [];
    // Destination-major, so a listing reads as one block per place on disk.
    for (const dest of dests) {
        for (const skill of skills) {
            pairs.push({
                skill,
                dest,
                path: installedPath(dest, skill.name),
                state: skillState(skill, dest),
            });
        }
    }
    return pairs;
}
function report(message) {
    console.log(message);
}
/** Replaces rather than merges: a file dropped from the packaged skill goes. */
export function copyOver(skill, target) {
    rmSync(target, { recursive: true, force: true });
    cpSync(skill.path, target, { recursive: true });
}
function announceCreated(dest) {
    const { created } = ensureSkillsDir(dest);
    if (!created)
        return;
    report(`  created ${dest.skillsDir}`);
    report(`  ${RESTART_CAVEAT}`);
}
/**
 * Installs each assignment, reporting every destination's outcome on its own
 * line. An identical copy is a no-op that is still reported — the user asked a
 * question and gets an answer either way — and is never a prompt.
 */
export async function installAssignments(assignments, confirm) {
    for (const { skill, dest, path, state } of assignments) {
        if (state.kind === "identical") {
            report(`already installed  ${skill.name} → ${path}`);
            continue;
        }
        if (state.kind !== "absent") {
            report(state.kind === "differs"
                ? `The installed copy differs from the packaged one: ${path}`
                : `The installed copy is ${describeState(state)}: ${path}`);
            if (!(await confirm(`Overwrite ${path}?`))) {
                report(`left unchanged     ${skill.name} → ${path}`);
                continue;
            }
        }
        announceCreated(dest);
        copyOver(skill, path);
        const verb = state.kind === "absent" ? "installed" : "overwrote";
        report(`${verb.padEnd(18)} ${skill.name} → ${path}`);
    }
}
/**
 * Names every directory it would delete before deleting any of them, so the
 * confirmation is over the whole set rather than one path at a time. A copy
 * with local modifications is called out inside that list: deleting it
 * discards work that exists nowhere else.
 */
export async function removeAssignments(assignments, confirm) {
    const targets = assignments.filter(({ state }) => state.kind !== "absent");
    for (const { skill, path, state } of assignments) {
        if (state.kind === "absent")
            report(`not installed      ${skill.name} → ${path}`);
    }
    if (targets.length === 0)
        return true;
    report("");
    report("These directories will be deleted:");
    for (const { path, state } of targets) {
        report(`  ${path}${state.kind === "differs" ? "   (has local modifications)" : ""}`);
    }
    if (!(await confirm("Delete them?"))) {
        report("Nothing was deleted.");
        return false;
    }
    deleteAssignments(targets);
    return true;
}
/** Deletes what has already been named and confirmed, reporting each path. */
export function deleteAssignments(targets) {
    for (const { path } of targets) {
        rmSync(path, { recursive: true, force: true });
        report(`deleted            ${path}`);
    }
}
//# sourceMappingURL=skill-actions.js.map