import { rmSync } from "fs";
import { checkbox } from "@inquirer/prompts";
import { copyOver } from "../skill-actions.js";
import { RESTART_CAVEAT, destinations, ensureSkillsDir, installedPath, } from "../skill-destinations.js";
import { listPackagedSkills } from "../skill-source.js";
import { skillState } from "../skill-state.js";
function pairsAt(project, dests) {
    const pairs = [];
    for (const dest of dests) {
        for (const skill of listPackagedSkills()) {
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
function destsFor(project) {
    return destinations(project.root);
}
function only(project, id) {
    const found = destsFor(project).find((dest) => dest.id === id);
    // Coverage reason: `DestinationId` is a closed union and `destsFor` returns
    // one entry per member, so no caller reaches this. The throw keeps the
    // return type honest instead of pushing a check onto every caller.
    /* node:coverage ignore next */
    if (!found)
        throw new Error(`Unknown destination: ${id}`);
    return found;
}
/**
 * The skills the package ships, provisioned as one item. `init` answers "set
 * this repo up"; `opsx-tools skill` remains the surface for one skill at one
 * destination, so the checklist here stays one line however many skills ship.
 */
export const skillsComponent = {
    id: "skills",
    label: "Skills",
    summary: "the skills this package ships, installed for your AI tool",
    /**
     * Reported for the project, because that is what the row governs. A copy at
     * the user destination is named in the detail rather than folded into the
     * verdict — it is real, and it is not what deselecting this row acts on.
     */
    inspect(project) {
        const packaged = listPackagedSkills();
        if (packaged.length === 0)
            return { kind: "absent" };
        const here = pairsAt(project, [only(project, "project")]);
        const alsoUser = pairsAt(project, [only(project, "user")]).some(({ state }) => state.kind !== "absent");
        // Coverage reason: the true side needs a copy under the real home
        // directory, which no test may write to. What it adds is one phrase in a
        // detail string; the row's verdict is decided by the project destination.
        /* node:coverage ignore next */
        const suffix = alsoUser ? ", also installed for your user" : "";
        const unreadable = here.find(({ state }) => state.kind === "unreadable");
        if (unreadable && unreadable.state.kind === "unreadable") {
            return { kind: "unsafe", reason: unreadable.state.reason };
        }
        const installed = here.filter(({ state }) => state.kind !== "absent");
        if (installed.length === 0)
            return { kind: "absent" };
        if (here.some(({ state }) => state.kind === "differs")) {
            return {
                kind: "differs",
                detail: `${installed.length}/${here.length} installed${suffix}`,
            };
        }
        return installed.length === here.length
            ? { kind: "provisioned", detail: `${here.length} installed${suffix}` }
            : {
                kind: "provisioned",
                detail: `${installed.length}/${here.length} installed${suffix}`,
            };
    },
    async choose(project, ctx) {
        const wanted = new Set();
        if (ctx.options.project)
            wanted.add("project");
        if (ctx.options.user)
            wanted.add("user");
        if (wanted.size > 0) {
            return { dests: destsFor(project).filter((dest) => wanted.has(dest.id)) };
        }
        // A destination supplied on the command line is never questioned; one that
        // was not is asked for rather than assumed, exactly as `skill` does.
        ctx.requireInteractive("A destination for the skills", [
            "--project   the project's .claude/skills/",
            "--user      ~/.claude/skills/",
        ]);
        const chosen = await checkbox({
            message: "Where should the skills be installed?",
            choices: destsFor(project).map((dest) => ({
                name: `${dest.label}  ${dest.skillsDir}`,
                value: dest,
                checked: dest.id === "project",
            })),
        });
        return chosen.length > 0 ? { dests: chosen } : null;
    },
    /**
     * Cleared, this removes from the project only. `init` prepares a repository,
     * and inferring the deletion of another project's skills from an unticked box
     * in this one is not a conclusion an unticked box can carry. The user
     * destination is emptied through `opsx-tools skill remove --user`.
     */
    plan(project, selection) {
        if (selection === null) {
            return pairsAt(project, [only(project, "project")])
                .filter(({ state }) => state.kind !== "absent")
                .map(({ skill, dest, path, state }) => ({
                kind: "path",
                action: "delete",
                path,
                note: state.kind === "differs" ? "has local modifications" : undefined,
                payload: { skill, dest },
            }));
        }
        return pairsAt(project, selection.dests)
            .filter(({ state }) => state.kind !== "identical")
            .map(({ skill, dest, path, state }) => ({
            kind: "path",
            action: "write",
            path,
            note: state.kind === "differs"
                ? "differs from the packaged copy, will be replaced"
                : state.kind === "unreadable"
                    ? `present but unreadable: ${state.reason}`
                    : undefined,
            payload: { skill, dest },
        }));
    },
    applyEdit(_project, edit) {
        if (edit.kind !== "path")
            return;
        if (edit.action === "delete") {
            rmSync(edit.path, { recursive: true, force: true });
            return;
        }
        const { skill, dest } = edit.payload;
        // A skills directory that did not exist when the AI tool started is only
        // seen after a restart, so creating one is said out loud rather than done
        // silently — otherwise a correct install looks like it failed.
        const { created } = ensureSkillsDir(dest);
        if (created) {
            console.log(`  created ${dest.skillsDir}`);
            console.log(`  ${RESTART_CAVEAT}`);
        }
        copyOver(skill, edit.path);
    },
};
//# sourceMappingURL=skills.js.map