import { Command } from "commander";
import { confirm as confirmPrompt, checkbox } from "@inquirer/prompts";
import { applyPlan, describeComponentState, renderPlan, } from "./component.js";
import { COMPONENTS } from "./components/index.js";
import { missingConfigReason } from "./components/artifact-language.js";
import { ExitError } from "./exit.js";
import { resolveProject } from "./project.js";
import { commandPath, usageError } from "./usage.js";
/**
 * Whether a flag was typed, as opposed to carrying the default Commander gives
 * an option that has a `--no-` form. The distinction is the whole point: an
 * option nobody typed must leave its component alone.
 */
function typedIntent(cmd, key) {
    if (cmd.getOptionValueSource(key) !== "cli")
        return undefined;
    return cmd.getOptionValue(key) === false ? "deselect" : "select";
}
/**
 * What the command line asked for, component by component. Naming an agreement
 * selects the component that holds it, so the working agreements need no flag
 * of their own to be switched on.
 */
function intentsFromFlags(cmd) {
    const intents = new Map();
    const skills = typedIntent(cmd, "skills");
    if (skills)
        intents.set("skills", skills);
    const lang = typedIntent(cmd, "lang");
    if (lang)
        intents.set("lang", lang);
    const workflow = typedIntent(cmd, "claudeWorkflow");
    if (workflow)
        intents.set("claude-workflow", workflow);
    if (typedIntent(cmd, "todos") || typedIntent(cmd, "questions")) {
        intents.set("claude-workflow", "select");
    }
    const commitRule = typedIntent(cmd, "commitRule");
    if (commitRule)
        intents.set("commit-convention", commitRule);
    return intents;
}
function reportStates(project, states) {
    console.log(`\nProject: ${project.name}  ${project.root}\n`);
    for (const component of COMPONENTS) {
        const state = states.get(component.id);
        console.log(`  ${component.label.padEnd(32)} ${describeComponentState(state)}`);
    }
    const missing = missingConfigReason(project);
    if (missing) {
        console.log(`\n  The artifact language needs OpenSpec's config file — ${missing}.`);
        console.log("  It is not created here: it requires a schema value only you can choose.");
    }
    console.log("");
}
/**
 * The interactive selection: every component, pre-checked to what is there now.
 * Checking provisions, clearing removes — safe as a default precisely because
 * the state that makes "cleared means removed" meaningful is on the screen.
 */
async function chooseInteractively(cmd, states) {
    const self = commandPath(cmd);
    requireInteractive(cmd, "A selection of components", [
        `${self} --skills --project           provision the skills`,
        `${self} --lang pt-BR                 set the artifact language`,
        `${self} --todos --questions          write the working agreements`,
        `${self} --commit-rule                write the commit convention rule`,
        `${self} --no-lang                    remove the artifact language`,
    ]);
    const present = COMPONENTS.filter((component) => states.get(component.id).kind !== "absent");
    const picked = await checkbox({
        message: "Check to provision, clear to remove",
        choices: COMPONENTS.map((component) => ({
            name: `${component.label}  — ${describeComponentState(states.get(component.id))}`,
            value: component,
            checked: states.get(component.id).kind !== "absent",
        })),
        pageSize: Math.min(COMPONENTS.length + 2, 20),
    });
    const intents = new Map();
    for (const component of picked)
        intents.set(component.id, "select");
    for (const component of present) {
        if (!picked.includes(component))
            intents.set(component.id, "deselect");
    }
    return intents;
}
function requireInteractive(cmd, missing, options) {
    if (process.stdin.isTTY)
        return;
    usageError(cmd, `${missing} must be supplied when input is not a terminal.`, [
        ...options.map((opt) => `  ${opt}`),
        "",
    ]);
}
/**
 * A file this package cannot edit safely stops the run before anything is
 * written. Refusing is always available and never destructive, which is why
 * every shape the editor does not recognize arrives here rather than at a
 * repair heuristic.
 */
function refuseUnsafe(component, state) {
    if (state.kind !== "unsafe")
        return;
    throw new ExitError(`[openspec-tools] ${component.label} cannot be provisioned: ${state.reason}.`, ["Nothing was written. Resolve that by hand and run this again."]);
}
export function initCommand() {
    const init = new Command("init")
        .description("provision this repository with what this package offers")
        .option("--skills", "install the skills this package ships")
        .option("--no-skills", "remove the skills this package installed here")
        .option("--lang <language>", "language for OpenSpec artifacts, e.g. pt-BR")
        .option("--no-lang", "remove the artifact language directive")
        .option("--todos", "ask the agent to keep a task list under openspec/")
        .option("--questions", "ask the agent to ask rather than assume under openspec/")
        .option("--no-claude-workflow", "remove the Claude Code working agreements")
        .option("--commit-rule", "write the one-line conventional-commit rule")
        .option("--no-commit-rule", "remove the one-line conventional-commit rule")
        .option("--project", "skills go to the project's .claude/skills/")
        .option("--user", "skills go to ~/.claude/skills/")
        .option("-y, --yes", "answer every confirmation affirmatively")
        .addHelpText("after", `
COMPONENTS
${COMPONENTS.map((c) => `  ${c.label.padEnd(32)} ${c.summary}`).join("\n")}

  Named with no flags, every component is shown with what is there now, as a
  selection you edit: checking provisions, clearing removes.

  Given flags, only the components you name are touched. A component you do
  not name is left exactly as it is — so a script written today cannot start
  removing a component added in a later release.

REQUIRES
  An OpenSpec project. This command never creates one; run 'openspec init'
  first if there is no openspec/ directory.

EXAMPLES
  opsx-tools init                              # show and edit every component
  opsx-tools init --skills --project --yes
  opsx-tools init --lang pt-BR --yes
  opsx-tools init --todos --questions --yes
  opsx-tools init --commit-rule --yes
  opsx-tools init --no-lang --yes              # remove just that one

NOTE
  'opsx-tools skill' remains the fine-grained surface: one skill, one
  destination, install and remove as separate verbs. This command treats the
  skills as one item.

  The working agreements and the commit rule are instructions written for the
  agent to read. They are not enforced: nothing here installs a Git hook, a
  Claude Code hook, or a message checker.
`);
    init.action(async (options, cmd) => {
        const project = resolveProject();
        // Checked before anything is asked: everything provisioned here is inert
        // without OpenSpec, so a repository that has none is not a smaller target,
        // it is the wrong one.
        if (project.source !== "openspec") {
            throw new ExitError(`[openspec-tools] No OpenSpec project here: nothing under ${project.root} owns an openspec/ directory.`, [
                "",
                "  Run 'openspec init' to create one, then run this again.",
                "",
                `${commandPath(cmd)} --help for what this provisions.`,
            ]);
        }
        const states = new Map(COMPONENTS.map((component) => [component.id, component.inspect(project)]));
        const flagIntents = intentsFromFlags(cmd);
        if (flagIntents.size === 0)
            reportStates(project, states);
        const intents = flagIntents.size > 0
            ? flagIntents
            : await chooseInteractively(cmd, states);
        if (intents.size === 0) {
            console.log("Nothing selected. Nothing was written.");
            return;
        }
        const ctx = {
            options: options,
            requireInteractive: (missing, opts) => requireInteractive(cmd, missing, opts),
        };
        const entries = [];
        const differing = [];
        for (const component of COMPONENTS) {
            const intent = intents.get(component.id);
            if (!intent)
                continue;
            const state = states.get(component.id);
            refuseUnsafe(component, state);
            if (state.kind === "differs")
                differing.push(component);
            const selection = intent === "select" ? await component.choose(project, ctx) : null;
            const edits = component.plan(project, selection);
            if (edits.length > 0)
                entries.push({ component, edits });
        }
        const all = entries.flatMap((entry) => entry.edits);
        if (all.length === 0) {
            console.log("Nothing to change.");
            return;
        }
        console.log("");
        for (const component of differing) {
            console.log(`${component.label} differs from what this package writes. The change below replaces it.`);
        }
        if (differing.length > 0)
            console.log("");
        for (const line of renderPlan(all))
            console.log(line);
        if (!options.yes) {
            requireInteractive(cmd, "A confirmation", [
                "--yes   answer every confirmation affirmatively",
            ]);
            if (!(await confirmPrompt({ message: "Apply these changes?", default: false }))) {
                console.log("Nothing was written or deleted.");
                return;
            }
        }
        applyPlan(project, entries);
        console.log("");
        console.log("Done.");
        const skillsWritten = entries.some((entry) => entry.component.id === "skills" &&
            entry.edits.some((edit) => edit.kind === "path" && edit.action === "write"));
        if (skillsWritten) {
            // Named, not run: nothing this package reports may depend on another
            // program having succeeded.
            console.log("Next: run 'openspec update' to refresh the AI instructions.");
        }
    });
    return init;
}
//# sourceMappingURL=init-cli.js.map