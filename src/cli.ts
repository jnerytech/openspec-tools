#!/usr/bin/env node
import { existsSync, statSync } from "fs";
import { resolve, relative, basename, sep } from "path";
import { createRequire } from "module";
import { Command, InvalidArgumentError } from "commander";
import type { TargetMode, ServerOptions } from "./types.js";
import { startServer } from "./server.js";
import { resolveProject } from "./project.js";
import { PORT_RANGE_START, PORT_RANGE_END } from "./port.js";
import {
  scanChanges,
  scanArchivedChanges,
  parseArchivedDirName,
  ARCHIVE_DIR_NAME,
} from "./scanner.js";

const requirePkg = createRequire(import.meta.url);
const pkg = requirePkg("../package.json") as { version: string };

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

interface Suggestion {
  name: string;
  archived: boolean;
}

function closeMatches(target: string, candidates: Suggestion[]): Suggestion[] {
  const needle = target.toLowerCase();
  return candidates.filter(({ name }) => {
    const candidate = name.toLowerCase();
    return candidate.includes(needle) || editDistance(needle, candidate) <= 3;
  });
}

function suggestionLine({ name, archived }: Suggestion): string {
  return `  ${name}${archived ? "  (archived)" : ""}`;
}

function displayPath(abs: string): string {
  const rel = relative(process.cwd(), abs);
  return rel && !rel.startsWith("..") ? `./${rel}` : abs;
}

async function openChangeNames(changesDir: string): Promise<Suggestion[]> {
  if (!existsSync(changesDir)) return [];
  const changes = await scanChanges(changesDir);
  return changes.map((c) => ({ name: c.name, archived: false }));
}

/** Archived changes are suggested by the name that actually resolves. */
async function archivedChangeNames(changesDir: string): Promise<Suggestion[]> {
  if (!existsSync(changesDir)) return [];
  const changes = await scanArchivedChanges(changesDir);
  return changes.map((c) => ({
    name: c.archived?.displayName ?? c.name,
    archived: true,
  }));
}

/** Lists every location tried, then helps the user find the right name. */
async function reportTargetNotFound(
  target: string,
  attempted: string[],
  changesDir: string
): Promise<never> {
  const details = attempted.map((p) => `  ${displayPath(p)}`);
  const open = await openChangeNames(changesDir);
  const archived = await archivedChangeNames(changesDir);
  const close = closeMatches(target, [...open, ...archived]);

  if (close.length > 0) {
    details.push("", "Did you mean?");
    for (const suggestion of close) details.push(suggestionLine(suggestion));
  }

  if (open.length === 0) {
    details.push("", `There are no open changes in ${DEFAULT_CHANGES_DIR}/.`);
  } else if (close.length === 0) {
    details.push("", "Available open changes:");
    for (const suggestion of open) details.push(suggestionLine(suggestion));
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
    // Naming the option is the whole discovery path — the archive is never
    // displayed just because the open set happens to be empty.
    const archiveOnly = existsSync(resolve(changesDir, ARCHIVE_DIR_NAME));
    console.warn(
      `[openspec-tools] No open changes in ${displayPath(changesDir)}/` +
        (archiveOnly ? " (only archive/ was found)." : ".") +
        `\n  Serving anyway — create a change and reload.` +
        (archiveOnly
          ? `\n  Run 'opsx-read --archived' to read the archived changes.`
          : "") +
        `\n  ${HELP_HINT}\n`
    );
  }

  return { kind: "changes", changesDir };
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

function archivedChangeMode(dirPath: string): TargetMode {
  const dirName = basename(dirPath);
  return {
    kind: "change",
    changeName: dirName,
    dirPath,
    archived: parseArchivedDirName(dirName),
  };
}

/**
 * The open change wins a name conflict — but the archived twin is named out
 * loud, following the same stance as the rest of the error guidance: pick the
 * likely intent, then point at the other option.
 */
async function warnArchivedTwin(
  target: string,
  changesBase: string
): Promise<void> {
  const archived = await scanArchivedChanges(changesBase);
  const twin = archived.find(
    (c) => c.name === target || c.archived?.displayName === target
  );
  if (!twin) return;

  console.warn(
    `[openspec-tools] Serving the open change '${target}'.\n` +
      `  An archived change of the same name also exists: ${twin.name}\n` +
      `  Read it with: opsx-read ${twin.name}\n`
  );
}

async function resolveMode(target: string | undefined): Promise<TargetMode> {
  if (!target) return resolveDefaultMode();

  const abs = resolve(process.cwd(), target);
  const changesBase = resolve(process.cwd(), DEFAULT_CHANGES_DIR);
  const archiveBase = resolve(changesBase, ARCHIVE_DIR_NAME);

  if (!existsSync(abs)) {
    const asChange = resolve(changesBase, target);
    const asArchived = resolve(archiveBase, target);

    // 'archive' names the archive itself, not a change inside it.
    if (asChange === archiveBase && isDirectory(archiveBase)) {
      return { kind: "archive", changesDir: changesBase };
    }

    // An open change name wins, out loud.
    if (isDirectory(asChange)) {
      await warnArchivedTwin(target, changesBase);
      return { kind: "change", changeName: target, dirPath: asChange };
    }

    // Archived directory name, date prefix and all.
    if (isDirectory(asArchived)) return archivedChangeMode(asArchived);

    // Archived display name, without the date prefix.
    const archived = await scanArchivedChanges(changesBase);
    const match = archived.find((c) => c.archived?.displayName === target);
    if (match) {
      return {
        kind: "change",
        changeName: match.name,
        dirPath: match.dirPath,
        archived: match.archived,
      };
    }

    return reportTargetNotFound(target, [abs, asChange, asArchived], changesBase);
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
    // The archive itself is a listing, not one change holding every archived
    // artifact — which is what the generic "under changes/" branch produced.
    if (abs === archiveBase) {
      return { kind: "archive", changesDir: changesBase };
    }

    if (abs.startsWith(archiveBase + sep)) {
      return archivedChangeMode(abs);
    }

    // Is it an openspec change directory?
    const isUnderChanges = abs.startsWith(changesBase) && abs !== changesBase;

    if (isUnderChanges) {
      const changeName = basename(abs);
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
  .option(
    "-p, --port <n>",
    "listen on this exact port, overriding the automatic choice",
    parsePort
  )
  .option("-o, --open", "open browser automatically", false)
  .option("-a, --archived", "include archived changes", false)
  .version(pkg.version, "-v, --version", "output the version number")
  .showHelpAfterError(HELP_HINT)
  .addHelpText(
    "after",
    `
TARGET
  (none)              List all open changes in ${DEFAULT_CHANGES_DIR}/
  <change-name>       Serve a specific change (name or path)
  <archived-name>     Serve an archived change, with or without its date prefix
  ${DEFAULT_CHANGES_DIR}/archive
                      List the archived changes
  <folder>            Serve all .md files in a folder
  <file.md>           Serve a single Markdown file
  help                Show this help

EXAMPLES
  opsx-read                          # list open changes
  opsx-read --archived               # list open and archived changes
  opsx-read add-dark-mode            # read a change
  opsx-read 2026-08-10-add-dark-mode # read an archived change
  opsx-read ./docs                   # serve a docs folder
  opsx-read CONTRIBUTING.md -o       # open a file in browser
  opsx-read -p 8080                  # pin the port instead

PORT
  Chosen automatically when --port is omitted: each project gets its own
  port in ${PORT_RANGE_START}-${PORT_RANGE_END}, derived from the project root, so the same project keeps
  the same URL across restarts and several readers can run side by side.
  If that port is taken, the next free one is used and the swap is announced.
  --port is never substituted: a busy port is reported as an error instead.

NOTE
  'help' is read as a command, not a target. A change actually named
  'help' must be addressed by path: opsx-read ${DEFAULT_CHANGES_DIR}/help
`
  )
  .action(async (
    target: string | undefined,
    options: { port?: number; open: boolean; archived: boolean }
  ) => {
    // 'help' is intercepted here rather than registered as a subcommand, which
    // would add a "Commands:" section to a CLI that has exactly one job.
    if (target === "help") {
      program.help();
    }

    const mode = await resolveMode(target);
    const opts: ServerOptions = {
      requestedPort: options.port,
      project: resolveProject(),
      mode,
      openBrowser: options.open,
      archived: options.archived,
    };
    await startServer(opts);
  });

await program.parseAsync(process.argv);
