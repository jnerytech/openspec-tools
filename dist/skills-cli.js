#!/usr/bin/env node
import { createRequire } from "module";
import { Command } from "commander";
import { checkbox, confirm as confirmPrompt } from "@inquirer/prompts";
import { ALWAYS_YES, assign, deleteAssignments, installAssignments, removeAssignments, } from "./skill-actions.js";
import { destinations } from "./skill-destinations.js";
import { listPackagedSkills } from "./skill-source.js";
import { describeState } from "./skill-state.js";
const requirePkg = createRequire(import.meta.url);
const pkg = requirePkg("../package.json");
const HELP_HINT = "Run 'opsx-skills --help' for usage.";
/**
 * Every usage error ends with the same pointer to --help, so no error path can
 * forget it. Never prints the full usage listing — the error stays first.
 */
function usageError(message, details = []) {
    console.error(`[openspec-tools] ${message}`);
    for (const line of details)
        console.error(line);
    console.error(HELP_HINT);
    process.exit(1);
}
/**
 * A question the session cannot answer is a failure, not a default: guessing a
 * destination would write somewhere the user never chose. The error names the
 * option that supplies the missing choice instead.
 */
function requireInteractive(missing, options) {
    if (process.stdin.isTTY)
        return;
    usageError(`${missing} must be supplied when input is not a terminal.`, [
        ...options.map((opt) => `  ${opt}`),
        "",
    ]);
}
function packagedOrExit() {
    const skills = listPackagedSkills();
    if (skills.length === 0) {
        console.log("[openspec-tools] This package ships no skills to install.");
        process.exit(0);
    }
    return skills;
}
/** An unknown name is answered with the names that do exist, never ignored. */
function selectSkills(names, packaged) {
    const chosen = [];
    for (const name of names) {
        const match = packaged.find((skill) => skill.name === name);
        if (!match) {
            usageError(`Unknown skill: ${name}`, [
                "",
                "This package ships:",
                ...packaged.map((skill) => `  ${skill.name}`),
                "",
            ]);
        }
        if (!chosen.includes(match))
            chosen.push(match);
    }
    return chosen;
}
const INSTALL = {
    verb: "install",
    skillsPrompt: "Which skills should be installed?",
    destPrompt: "Where should the skills be installed?",
};
const REMOVE = {
    verb: "remove",
    skillsPrompt: "Which skills should be removed?",
    destPrompt: "Which destinations should the skills be removed from?",
};
async function resolveSkills(names, packaged, action) {
    if (names.length > 0)
        return selectSkills(names, packaged);
    requireInteractive("A skill name", [
        `opsx-skills ${action.verb} <skill>...   name the skills explicitly`,
    ]);
    return checkbox({
        message: action.skillsPrompt,
        choices: packaged.map((skill) => ({ name: skill.name, value: skill })),
    });
}
function selectedDestinations(options) {
    const wanted = new Set();
    if (options.project)
        wanted.add("project");
    if (options.user)
        wanted.add("user");
    return destinations().filter((dest) => wanted.has(dest.id));
}
/** A destination supplied on the command line is never questioned. */
async function resolveDestinations(options, action) {
    const supplied = selectedDestinations(options);
    if (supplied.length > 0)
        return supplied;
    requireInteractive("A destination", [
        "--project   the project's .claude/skills/",
        "--user      ~/.claude/skills/",
    ]);
    return checkbox({
        message: action.destPrompt,
        choices: destinations().map((dest) => ({
            name: `${dest.label}  ${dest.skillsDir}`,
            value: dest,
        })),
    });
}
function confirmer(options) {
    if (options.yes)
        return ALWAYS_YES;
    return async (message) => {
        requireInteractive("A confirmation", [
            "--yes   answer every confirmation affirmatively",
        ]);
        return confirmPrompt({ message, default: false });
    };
}
function withCommonOptions(command) {
    return command
        .option("--project", "the project's .claude/skills/ directory")
        .option("--user", "the user's ~/.claude/skills/ directory")
        .option("-y, --yes", "answer every confirmation affirmatively");
}
function listState(assignments) {
    let currentDest = "";
    for (const { skill, dest, path, state } of assignments) {
        if (dest.skillsDir !== currentDest) {
            currentDest = dest.skillsDir;
            console.log(`\n${dest.label}  ${dest.skillsDir}`);
        }
        console.log(`  ${skill.name.padEnd(28)} ${describeState(state)}`);
    }
}
/**
 * The bare invocation: every skill at every destination shown with what is
 * there now, as a selection the user edits. Checking installs, clearing
 * removes, and the resulting writes and deletions are named before anything
 * happens.
 */
async function syncInteractively(options) {
    const packaged = packagedOrExit();
    const assignments = assign(packaged, destinations());
    listState(assignments);
    console.log("");
    requireInteractive("A selection", [
        "opsx-skills install <skill> --project --user --yes",
        "opsx-skills remove  <skill> --project --user --yes",
    ]);
    const installed = assignments.filter(({ state }) => state.kind !== "absent");
    const picked = await checkbox({
        message: "Check to install, clear to remove",
        choices: assignments.map((entry) => ({
            name: `${entry.skill.name}  @ ${entry.dest.label}  — ${describeState(entry.state)}`,
            value: entry,
            checked: entry.state.kind !== "absent",
        })),
        pageSize: Math.min(assignments.length + 2, 20),
    });
    const toInstall = picked.filter(({ state }) => state.kind === "absent");
    const toDelete = installed.filter((entry) => !picked.includes(entry));
    if (toInstall.length === 0 && toDelete.length === 0) {
        console.log("Nothing to change.");
        return;
    }
    if (toInstall.length > 0) {
        console.log("\nWill be written:");
        for (const { path } of toInstall)
            console.log(`  ${path}`);
    }
    if (toDelete.length > 0) {
        console.log("\nWill be deleted:");
        for (const { path, state } of toDelete) {
            console.log(`  ${path}${state.kind === "differs" ? "   (has local modifications)" : ""}`);
        }
    }
    console.log("");
    const confirm = confirmer(options);
    if (!(await confirm("Apply these changes?"))) {
        console.log("Nothing was written or deleted.");
        return;
    }
    // Already named and confirmed as one set, so neither step asks again.
    await installAssignments(toInstall, ALWAYS_YES);
    deleteAssignments(toDelete);
}
const program = new Command();
program
    .name("opsx-skills")
    .description("install and remove the skills this package ships")
    .version(pkg.version, "-v, --version", "output the version number")
    .showHelpAfterError(HELP_HINT)
    .enablePositionalOptions();
withCommonOptions(program).addHelpText("after", `
DESTINATIONS
  --project   <project-root>/.claude/skills/, the same project root opsx-read
              derives its port from — the nearest folder owning openspec/,
              else the repository root
  --user      ~/.claude/skills/

  Neither given: you are asked. A destination is never assumed.

EXAMPLES
  opsx-skills                                    # show and edit current state
  opsx-skills list                               # state at both destinations
  opsx-skills install openspec-review-change --user
  opsx-skills install --project                  # pick the skills interactively
  opsx-skills remove openspec-review-change --project --yes

NOTE
  Only the skills this package ships can be installed or removed. A skill
  directory at a destination that this package does not ship is never listed,
  offered, or deleted.
`);
withCommonOptions(program
    .command("install")
    .description("copy skills into a destination")
    .argument("[skills...]", "skill names (default: asked interactively)")).action(async (names, options) => {
    const packaged = packagedOrExit();
    const skills = await resolveSkills(names, packaged, INSTALL);
    const dests = await resolveDestinations(options, INSTALL);
    if (skills.length === 0 || dests.length === 0) {
        console.log("Nothing selected. Nothing was written.");
        return;
    }
    await installAssignments(assign(skills, dests), confirmer(options));
});
withCommonOptions(program
    .command("remove")
    .description("delete installed copies of skills")
    .argument("[skills...]", "skill names (default: asked interactively)")).action(async (names, options) => {
    const packaged = packagedOrExit();
    const skills = await resolveSkills(names, packaged, REMOVE);
    const dests = await resolveDestinations(options, REMOVE);
    if (skills.length === 0 || dests.length === 0) {
        console.log("Nothing selected. Nothing was deleted.");
        return;
    }
    await removeAssignments(assign(skills, dests), confirmer(options));
});
withCommonOptions(program
    .command("list")
    .description("report each skill's state at each destination")
    .argument("[skills...]", "skill names (default: all packaged skills)")).action(async (names, options) => {
    const packaged = packagedOrExit();
    const skills = names.length > 0 ? selectSkills(names, packaged) : packaged;
    // Reading reports both places unless one is asked for; nothing is written,
    // so there is no choice here to withhold.
    const chosen = selectedDestinations(options);
    listState(assign(skills, chosen.length > 0 ? chosen : destinations()));
});
program.action(async (options) => {
    await syncInteractively(options);
});
try {
    await program.parseAsync(process.argv);
}
catch (err) {
    // A prompt closed with Ctrl-C is a cancelled invocation, not a crash.
    if (err?.name === "ExitPromptError") {
        console.error("[openspec-tools] Cancelled. Nothing was written or deleted.");
        process.exit(1);
    }
    throw err;
}
//# sourceMappingURL=skills-cli.js.map