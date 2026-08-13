import { createRequire } from "module";
import { Command } from "commander";
import { readCommand } from "./cli.js";
import { initCommand } from "./init-cli.js";
import { skillCommand } from "./skills-cli.js";
import { helpHint } from "./usage.js";
const requirePkg = createRequire(import.meta.url);
const pkg = requirePkg("../package.json");
export const VERSION = pkg.version;
/**
 * Applied once the tree is assembled, so every command knows its own full path
 * and can point a failed invocation at its own help rather than the root's.
 */
function applyHelpHints(cmd) {
    cmd.showHelpAfterError(helpHint(cmd));
    for (const sub of cmd.commands)
        applyHelpHints(sub);
}
/**
 * The command tree, built but not run. Separated from `main.ts` so the same
 * tree can be driven by a caller that is not a process entry point — which is
 * what lets a test invoke a command and observe its refusal in the process the
 * coverage instrumentation is measuring, rather than only from outside.
 */
export function buildProgram() {
    const program = new Command();
    program
        .name("opsx-tools")
        .description("set up an OpenSpec project, read its changes in the browser, and manage the skills this package ships")
        .version(VERSION, "-v, --version", "output the version number")
        .enablePositionalOptions()
        .addHelpText("after", `
EXAMPLES
  opsx-tools init                  # set this repo up with what this package offers
  opsx-tools read                  # list the open changes in this project
  opsx-tools read add-dark-mode    # read one change
  opsx-tools skill                 # show and edit which skills are installed
  opsx-tools skill install openspec-review-change --project

Run 'opsx-tools <command> --help' for what a command accepts.
`);
    program.addCommand(readCommand());
    program.addCommand(skillCommand());
    program.addCommand(initCommand());
    applyHelpHints(program);
    return program;
}
//# sourceMappingURL=program.js.map