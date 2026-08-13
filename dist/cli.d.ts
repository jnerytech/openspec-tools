import { Command } from "commander";
import type { TargetMode } from "./types.js";
/**
 * Which target the reader was pointed at. Exported because it is the whole of
 * what a `read` invocation decides before anything is bound: driving it
 * directly is how the resolution is exercised without starting a server, in the
 * process the coverage instrumentation is measuring.
 */
export declare function resolveMode(cmd: Command, target: string | undefined): Promise<TargetMode>;
/**
 * The reading capability as a subcommand. Under an explicit verb every
 * positional word is a target, so no name has to be reserved and intercepted.
 */
export declare function readCommand(): Command;
//# sourceMappingURL=cli.d.ts.map