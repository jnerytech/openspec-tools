import type { Command } from "commander";
/**
 * The command path as the user typed it — "opsx-tools read", not "read".
 * Walking to the root is what lets a hint name the whole invocation without
 * any command hardcoding its own ancestry.
 */
export declare function commandPath(cmd: Command): string;
/**
 * Names the help of the command that failed, so the suggested command answers
 * the question the user actually asked. Derived rather than written out, so a
 * subcommand added later gets a correct hint without anyone remembering to.
 */
export declare function helpHint(cmd: Command): string;
/**
 * Every usage error ends with the same pointer to the failing command's help,
 * so no error path can forget it. Never prints the full usage listing — the
 * error stays first.
 */
export declare function usageError(cmd: Command, message: string, details?: string[]): never;
//# sourceMappingURL=usage.d.ts.map