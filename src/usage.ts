import type { Command } from "commander";

/**
 * The command path as the user typed it — "opsx-tools read", not "read".
 * Walking to the root is what lets a hint name the whole invocation without
 * any command hardcoding its own ancestry.
 */
export function commandPath(cmd: Command): string {
  const parts: string[] = [];
  for (let c: Command | null = cmd; c; c = c.parent) parts.unshift(c.name());
  return parts.join(" ");
}

/**
 * Names the help of the command that failed, so the suggested command answers
 * the question the user actually asked. Derived rather than written out, so a
 * subcommand added later gets a correct hint without anyone remembering to.
 */
export function helpHint(cmd: Command): string {
  return `Run '${commandPath(cmd)} --help' for usage.`;
}

/**
 * Every usage error ends with the same pointer to the failing command's help,
 * so no error path can forget it. Never prints the full usage listing — the
 * error stays first.
 */
export function usageError(
  cmd: Command,
  message: string,
  details: string[] = []
): never {
  console.error(`[openspec-tools] ${message}`);
  for (const line of details) console.error(line);
  console.error(helpHint(cmd));
  process.exit(1);
}
