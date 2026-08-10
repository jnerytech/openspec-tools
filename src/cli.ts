#!/usr/bin/env node
import { existsSync, statSync } from "fs";
import { resolve, relative } from "path";
import { createRequire } from "module";
import { Command, InvalidArgumentError } from "commander";
import type { TargetMode, ServerOptions } from "./types.js";
import { startServer } from "./server.js";
import { scanChanges } from "./scanner.js";

const requirePkg = createRequire(import.meta.url);
const pkg = requirePkg("../package.json") as { version: string };

const DEFAULT_PORT = 4242;
const DEFAULT_CHANGES_DIR = "openspec/changes";
const HELP_HINT = "Run 'opsx-read --help' for usage.";

/**
 * Every usage error ends with the same pointer to --help, so no error path
 * can forget it. Never prints the full usage listing — the error stays first.
 */
function usageError(message: string, details: string[] = []): never {
  console.error(`[openspec-tools] ${message}`);
  for (const line of details) console.error(line);
  console.error(HELP_HINT);
  process.exit(1);
}

function parsePort(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port)) {
    throw new InvalidArgumentError("Port must be a number.");
  }
  return port;
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, j) => j);

  for (let i = 1; i < rows; i++) {
    const curr = [i];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }

  return prev[cols - 1];
}

function closeMatches(target: string, names: string[]): string[] {
  const needle = target.toLowerCase();
  return names.filter((name) => {
    const candidate = name.toLowerCase();
    return candidate.includes(needle) || editDistance(needle, candidate) <= 3;
  });
}

function displayPath(abs: string): string {
  const rel = relative(process.cwd(), abs);
  return rel && !rel.startsWith("..") ? `./${rel}` : abs;
}

async function openChangeNames(changesDir: string): Promise<string[]> {
  if (!existsSync(changesDir)) return [];
  const changes = await scanChanges(changesDir);
  return changes.map((c) => c.name);
}

/** Lists every location tried, then helps the user find the right name. */
async function reportTargetNotFound(
  target: string,
  attempted: string[],
  changesDir: string
): Promise<never> {
  const details = attempted.map((p) => `  ${displayPath(p)}`);
  const names = await openChangeNames(changesDir);

  if (names.length === 0) {
    details.push("", `There are no open changes in ${DEFAULT_CHANGES_DIR}/.`);
  } else {
    const close = closeMatches(target, names);
    const shown = close.length > 0 ? close : names;
    details.push("", close.length > 0 ? "Did you mean?" : "Available open changes:");
    for (const name of shown) details.push(`  ${name}`);
  }

  details.push("");
  return usageError(`Target '${target}' not found. Tried:`, details);
}

/** No target: always serves, but explains what it found first. */
async function resolveDefaultMode(): Promise<TargetMode> {
  const changesDir = resolve(process.cwd(), DEFAULT_CHANGES_DIR);

  if (!existsSync(changesDir)) {
    console.warn(
      `[openspec-tools] ${DEFAULT_CHANGES_DIR}/ not found in ${process.cwd()}.\n` +
        `  Are you in your project root? Serving an empty list anyway.\n` +
        `  ${HELP_HINT}\n`
    );
    return { kind: "changes", changesDir };
  }

  const changes = await scanChanges(changesDir);
  if (changes.length === 0) {
    const archiveOnly = existsSync(resolve(changesDir, "archive"));
    console.warn(
      `[openspec-tools] No open changes in ${displayPath(changesDir)}/` +
        (archiveOnly ? " (only archive/ was found)." : ".") +
        `\n  Serving anyway — create a change and reload.\n` +
        `  ${HELP_HINT}\n`
    );
  }

  return { kind: "changes", changesDir };
}

async function resolveMode(target: string | undefined): Promise<TargetMode> {
  if (!target) return resolveDefaultMode();

  const abs = resolve(process.cwd(), target);
  const changesBase = resolve(process.cwd(), DEFAULT_CHANGES_DIR);

  if (!existsSync(abs)) {
    // Maybe it's a change name (relative to openspec/changes/)
    const asChange = resolve(changesBase, target);
    if (existsSync(asChange) && statSync(asChange).isDirectory()) {
      return { kind: "change", changeName: target, dirPath: asChange };
    }
    return reportTargetNotFound(target, [abs, asChange], changesBase);
  }

  const stat = statSync(abs);

  if (stat.isFile()) {
    if (!abs.endsWith(".md")) {
      usageError(`Not a Markdown file: ${displayPath(abs)}`, [
        "  Only .md files can be served directly.",
        "",
      ]);
    }
    return { kind: "file", filePath: abs };
  }

  if (stat.isDirectory()) {
    // Is it an openspec change directory?
    const isUnderChanges = abs.startsWith(changesBase) && abs !== changesBase;

    if (isUnderChanges) {
      const changeName = abs.split("/").pop() ?? target;
      return { kind: "change", changeName, dirPath: abs };
    }

    // Is this the changes/ directory itself?
    if (abs === changesBase) {
      return { kind: "changes", changesDir: abs };
    }

    // Generic folder
    return { kind: "dir", dirPath: abs };
  }

  return usageError(`Unsupported target type: ${displayPath(abs)}`, [""]);
}

const program = new Command();

program
  .name("opsx-read")
  .description("serve OpenSpec changes as read-aloud-friendly web pages")
  .argument("[target]", "change name, folder, or .md file (default: openspec/changes/)")
  .option("-p, --port <n>", "port to listen on", parsePort, DEFAULT_PORT)
  .option("-o, --open", "open browser automatically", false)
  .version(pkg.version, "-v, --version", "output the version number")
  .showHelpAfterError(HELP_HINT)
  .addHelpText(
    "after",
    `
TARGET
  (none)              List all open changes in ${DEFAULT_CHANGES_DIR}/
  <change-name>       Serve a specific change (name or path)
  <folder>            Serve all .md files in a folder
  <file.md>           Serve a single Markdown file
  help                Show this help

EXAMPLES
  opsx-read                          # list open changes
  opsx-read add-dark-mode            # read a change
  opsx-read ./docs                   # serve a docs folder
  opsx-read CONTRIBUTING.md -o       # open a file in browser
  opsx-read -p 8080                  # custom port

NOTE
  'help' is read as a command, not a target. A change actually named
  'help' must be addressed by path: opsx-read ${DEFAULT_CHANGES_DIR}/help
`
  )
  .action(async (target: string | undefined, options: { port: number; open: boolean }) => {
    // 'help' is intercepted here rather than registered as a subcommand, which
    // would add a "Commands:" section to a CLI that has exactly one job.
    if (target === "help") {
      program.help();
    }

    const mode = await resolveMode(target);
    const opts: ServerOptions = {
      port: options.port,
      mode,
      openBrowser: options.open,
    };
    startServer(opts);
  });

await program.parseAsync(process.argv);
