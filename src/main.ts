#!/usr/bin/env node
/* node:coverage disable */
/*
 * Coverage reason: this file is the process entry point, and everything in it
 * is the part that only a process has — reading `process.argv`, and ending with
 * an exit code. Importing it to exercise it would run it, and the one thing it
 * does is terminate the process doing the measuring. The command tree it builds
 * lives in `program.ts`, which is exercised directly; what is left here is the
 * shebang, the argv check and the exit, all verified from outside by the
 * subprocess suite, which is where an exit code is observable at all.
 */
import { isExitError } from "./exit.js";
import { buildProgram } from "./program.js";

/**
 * The process entry point, and the only place in this package where a process
 * ends. Everything below it throws instead of exiting, which is what lets the
 * same code be driven by a caller that is not a process.
 */

const program = buildProgram();

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
} catch (err) {
  // The one place a refusal becomes an exit code.
  if (isExitError(err)) {
    const write = err.code === 0 ? console.log : console.error;
    write(err.message);
    for (const line of err.details) write(line);
    process.exit(err.code);
  }

  // A prompt closed with Ctrl-C is a cancelled invocation, not a crash.
  if ((err as Error)?.name === "ExitPromptError") {
    console.error("[openspec-tools] Cancelled. Nothing was written or deleted.");
    process.exit(1);
  }
  throw err;
}
/* node:coverage enable */
