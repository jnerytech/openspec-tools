#!/usr/bin/env node
import { createRequire } from "module";
import { Command } from "commander";
import { readCommand } from "./cli.js";
import { skillCommand } from "./skills-cli.js";
import { helpHint } from "./usage.js";
const requirePkg = createRequire(import.meta.url);
const pkg = requirePkg("../package.json");
/**
 * Applied once the tree is assembled, so every command knows its own full path
 * and can point a failed invocation at its own help rather than the root's.
 */
function applyHelpHints(cmd) {
    cmd.showHelpAfterError(helpHint(cmd));
    for (const sub of cmd.commands)
        applyHelpHints(sub);
}
const program = new Command();
program
    .name("opsx-tools")
    .description("read OpenSpec changes in the browser, and manage the skills this package ships")
    .version(pkg.version, "-v, --version", "output the version number")
    .enablePositionalOptions()
    .addHelpText("after", `
EXAMPLES
  opsx-tools read                  # list the open changes in this project
  opsx-tools read add-dark-mode    # read one change
  opsx-tools skill                 # show and edit which skills are installed
  opsx-tools skill install openspec-review-change --project

Run 'opsx-tools <command> --help' for what a command accepts.
`);
program.addCommand(readCommand());
program.addCommand(skillCommand());
applyHelpHints(program);
// Invoked bare, the tool says what it can do rather than choosing a capability
// on the user's behalf — which is also what keeps every word free to name a
// change under 'read'. Handled before parsing rather than by a root action
// handler: an action handler on a command that only dispatches turns an
// unknown command into "too many arguments", which names the wrong thing.
// Commander's own no-argument behaviour is to exit 1, so this is not a no-op.
if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
}
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
//# sourceMappingURL=main.js.map