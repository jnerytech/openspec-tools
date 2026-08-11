import { Command } from "commander";
import { checkbox, confirm as confirmPrompt } from "@inquirer/prompts";
import type {
  Assignment,
} from "./skill-actions.js";
import {
  ALWAYS_YES,
  assign,
  deleteAssignments,
  installAssignments,
  removeAssignments,
} from "./skill-actions.js";
import { destinations } from "./skill-destinations.js";
import { listPackagedSkills } from "./skill-source.js";
import { describeState } from "./skill-state.js";
import { commandPath, usageError } from "./usage.js";
import type { Confirm } from "./skill-actions.js";
import type { Destination, DestinationId, PackagedSkill } from "./types.js";

interface CommonOptions {
  project?: boolean;
  user?: boolean;
  yes?: boolean;
}

/**
 * A question the session cannot answer is a failure, not a default: guessing a
 * destination would write somewhere the user never chose. The error names the
 * option that supplies the missing choice instead.
 */
function requireInteractive(
  cmd: Command,
  missing: string,
  options: string[]
): void {
  if (process.stdin.isTTY) return;
  usageError(cmd, `${missing} must be supplied when input is not a terminal.`, [
    ...options.map((opt) => `  ${opt}`),
    "",
  ]);
}

function packagedOrExit(): PackagedSkill[] {
  const skills = listPackagedSkills();
  if (skills.length === 0) {
    console.log("[openspec-tools] This package ships no skills to install.");
    process.exit(0);
  }
  return skills;
}

/** An unknown name is answered with the names that do exist, never ignored. */
function selectSkills(
  cmd: Command,
  names: string[],
  packaged: PackagedSkill[]
): PackagedSkill[] {
  const chosen: PackagedSkill[] = [];
  for (const name of names) {
    const match = packaged.find((skill) => skill.name === name);
    if (!match) {
      usageError(cmd, `Unknown skill: ${name}`, [
        "",
        "This package ships:",
        ...packaged.map((skill) => `  ${skill.name}`),
        "",
      ]);
    }
    if (!chosen.includes(match)) chosen.push(match);
  }
  return chosen;
}

/** What a verb calls itself, so a prompt reads as a sentence. */
interface Action {
  verb: string;
  skillsPrompt: string;
  destPrompt: string;
}

const INSTALL: Action = {
  verb: "install",
  skillsPrompt: "Which skills should be installed?",
  destPrompt: "Where should the skills be installed?",
};

const REMOVE: Action = {
  verb: "remove",
  skillsPrompt: "Which skills should be removed?",
  destPrompt: "Which destinations should the skills be removed from?",
};

async function resolveSkills(
  cmd: Command,
  names: string[],
  packaged: PackagedSkill[],
  action: Action
): Promise<PackagedSkill[]> {
  if (names.length > 0) return selectSkills(cmd, names, packaged);

  requireInteractive(cmd, "A skill name", [
    `${commandPath(cmd)} <skill>...   name the skills explicitly`,
  ]);

  return checkbox({
    message: action.skillsPrompt,
    choices: packaged.map((skill) => ({ name: skill.name, value: skill })),
  });
}

function selectedDestinations(options: CommonOptions): Destination[] {
  const wanted = new Set<DestinationId>();
  if (options.project) wanted.add("project");
  if (options.user) wanted.add("user");
  return destinations().filter((dest) => wanted.has(dest.id));
}

/** A destination supplied on the command line is never questioned. */
async function resolveDestinations(
  cmd: Command,
  options: CommonOptions,
  action: Action
): Promise<Destination[]> {
  const supplied = selectedDestinations(options);
  if (supplied.length > 0) return supplied;

  requireInteractive(cmd, "A destination", [
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

function confirmer(cmd: Command, options: CommonOptions): Confirm {
  if (options.yes) return ALWAYS_YES;
  return async (message: string) => {
    requireInteractive(cmd, "A confirmation", [
      "--yes   answer every confirmation affirmatively",
    ]);
    return confirmPrompt({ message, default: false });
  };
}

function withCommonOptions(command: Command): Command {
  return command
    .option("--project", "the project's .claude/skills/ directory")
    .option("--user", "the user's ~/.claude/skills/ directory")
    .option("-y, --yes", "answer every confirmation affirmatively");
}

function listState(assignments: Assignment[]): void {
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
async function syncInteractively(
  cmd: Command,
  options: CommonOptions
): Promise<void> {
  const packaged = packagedOrExit();
  const assignments = assign(packaged, destinations());

  listState(assignments);
  console.log("");

  const self = commandPath(cmd);
  requireInteractive(cmd, "A selection", [
    `${self} install <skill> --project --user --yes`,
    `${self} remove  <skill> --project --user --yes`,
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
    for (const { path } of toInstall) console.log(`  ${path}`);
  }
  if (toDelete.length > 0) {
    console.log("\nWill be deleted:");
    for (const { path, state } of toDelete) {
      console.log(
        `  ${path}${state.kind === "differs" ? "   (has local modifications)" : ""}`
      );
    }
  }
  console.log("");

  const confirm = confirmer(cmd, options);
  if (!(await confirm("Apply these changes?"))) {
    console.log("Nothing was written or deleted.");
    return;
  }

  // Already named and confirmed as one set, so neither step asks again.
  await installAssignments(toInstall, ALWAYS_YES);
  deleteAssignments(toDelete);
}

/**
 * The skill-management capability as a subcommand. Positional options are
 * enabled here because the verbs beneath it carry the same option names it
 * does: an option after a verb belongs to that verb.
 */
export function skillCommand(): Command {
  const skill = new Command("skill")
    .description("install and remove the skills this package ships")
    .enablePositionalOptions();

  withCommonOptions(skill).addHelpText(
    "after",
    `
DESTINATIONS
  --project   <project-root>/.claude/skills/, the same project root
              'opsx-tools read' derives its port from — the nearest folder
              owning openspec/, else the repository root
  --user      ~/.claude/skills/

  Neither given: you are asked. A destination is never assumed.

EXAMPLES
  opsx-tools skill                               # show and edit current state
  opsx-tools skill list                          # state at both destinations
  opsx-tools skill install openspec-review-change --user
  opsx-tools skill install --project             # pick the skills interactively
  opsx-tools skill remove openspec-review-change --project --yes

NOTE
  Only the skills this package ships can be installed or removed. A skill
  directory at a destination that this package does not ship is never listed,
  offered, or deleted.
`
  );

  withCommonOptions(
    skill
      .command("install")
      .description("copy skills into a destination")
      .argument("[skills...]", "skill names (default: asked interactively)")
  ).action(async (names: string[], options: CommonOptions, cmd: Command) => {
    const packaged = packagedOrExit();
    const skills = await resolveSkills(cmd, names, packaged, INSTALL);
    const dests = await resolveDestinations(cmd, options, INSTALL);
    if (skills.length === 0 || dests.length === 0) {
      console.log("Nothing selected. Nothing was written.");
      return;
    }
    await installAssignments(assign(skills, dests), confirmer(cmd, options));
  });

  withCommonOptions(
    skill
      .command("remove")
      .description("delete installed copies of skills")
      .argument("[skills...]", "skill names (default: asked interactively)")
  ).action(async (names: string[], options: CommonOptions, cmd: Command) => {
    const packaged = packagedOrExit();
    const skills = await resolveSkills(cmd, names, packaged, REMOVE);
    const dests = await resolveDestinations(cmd, options, REMOVE);
    if (skills.length === 0 || dests.length === 0) {
      console.log("Nothing selected. Nothing was deleted.");
      return;
    }
    await removeAssignments(assign(skills, dests), confirmer(cmd, options));
  });

  withCommonOptions(
    skill
      .command("list")
      .description("report each skill's state at each destination")
      .argument("[skills...]", "skill names (default: all packaged skills)")
  ).action(async (names: string[], options: CommonOptions, cmd: Command) => {
    const packaged = packagedOrExit();
    const skills = names.length > 0 ? selectSkills(cmd, names, packaged) : packaged;
    // Reading reports both places unless one is asked for; nothing is written,
    // so there is no choice here to withhold.
    const chosen = selectedDestinations(options);
    listState(assign(skills, chosen.length > 0 ? chosen : destinations()));
  });

  skill.action(async (options: CommonOptions, cmd: Command) => {
    await syncInteractively(cmd, options);
  });

  return skill;
}
