import { existsSync, statSync } from "fs";
import { resolve, relative, basename, sep } from "path";
import { Command, InvalidArgumentError } from "commander";
import { startServer } from "./server.js";
import { resolveProject } from "./project.js";
import { PORT_RANGE_START, PORT_RANGE_END } from "./port.js";
import { commandPath, helpHint, usageError } from "./usage.js";
import { scanChanges, scanArchivedChanges, parseArchivedDirName, ARCHIVE_DIR_NAME, } from "./scanner.js";
const DEFAULT_CHANGES_DIR = "openspec/changes";
function parsePort(value) {
    const port = parseInt(value, 10);
    if (isNaN(port)) {
        throw new InvalidArgumentError("Port must be a number.");
    }
    return port;
}
function editDistance(a, b) {
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
function closeMatches(target, candidates) {
    const needle = target.toLowerCase();
    return candidates.filter(({ name }) => {
        const candidate = name.toLowerCase();
        return candidate.includes(needle) || editDistance(needle, candidate) <= 3;
    });
}
function suggestionLine({ name, archived }) {
    return `  ${name}${archived ? "  (archived)" : ""}`;
}
function displayPath(abs) {
    const rel = relative(process.cwd(), abs);
    return rel && !rel.startsWith("..") ? `./${rel}` : abs;
}
async function openChangeNames(changesDir) {
    if (!existsSync(changesDir))
        return [];
    const changes = await scanChanges(changesDir);
    return changes.map((c) => ({ name: c.name, archived: false }));
}
/** Archived changes are suggested by the name that actually resolves. */
async function archivedChangeNames(changesDir) {
    if (!existsSync(changesDir))
        return [];
    const changes = await scanArchivedChanges(changesDir);
    return changes.map((c) => ({
        name: c.archived?.displayName ?? c.name,
        archived: true,
    }));
}
/** Lists every location tried, then helps the user find the right name. */
async function reportTargetNotFound(cmd, target, attempted, changesDir) {
    const details = attempted.map((p) => `  ${displayPath(p)}`);
    const open = await openChangeNames(changesDir);
    const archived = await archivedChangeNames(changesDir);
    const close = closeMatches(target, [...open, ...archived]);
    if (close.length > 0) {
        details.push("", "Did you mean?");
        for (const suggestion of close)
            details.push(suggestionLine(suggestion));
    }
    if (open.length === 0) {
        details.push("", `There are no open changes in ${DEFAULT_CHANGES_DIR}/.`);
    }
    else if (close.length === 0) {
        details.push("", "Available open changes:");
        for (const suggestion of open)
            details.push(suggestionLine(suggestion));
    }
    details.push("");
    return usageError(cmd, `Target '${target}' not found. Tried:`, details);
}
/** No target: always serves, but explains what it found first. */
async function resolveDefaultMode(cmd) {
    const changesDir = resolve(process.cwd(), DEFAULT_CHANGES_DIR);
    if (!existsSync(changesDir)) {
        console.warn(`[openspec-tools] ${DEFAULT_CHANGES_DIR}/ not found in ${process.cwd()}.\n` +
            `  Are you in your project root? Serving an empty list anyway.\n` +
            `  ${helpHint(cmd)}\n`);
        return { kind: "changes", changesDir };
    }
    const changes = await scanChanges(changesDir);
    if (changes.length === 0) {
        // Naming the option is the whole discovery path — the archive is never
        // displayed just because the open set happens to be empty.
        const archiveOnly = existsSync(resolve(changesDir, ARCHIVE_DIR_NAME));
        console.warn(`[openspec-tools] No open changes in ${displayPath(changesDir)}/` +
            (archiveOnly ? " (only archive/ was found)." : ".") +
            `\n  Serving anyway — create a change and reload.` +
            (archiveOnly
                ? `\n  Run '${commandPath(cmd)} --archived' to read the archived changes.`
                : "") +
            `\n  ${helpHint(cmd)}\n`);
    }
    return { kind: "changes", changesDir };
}
function isDirectory(path) {
    return existsSync(path) && statSync(path).isDirectory();
}
function archivedChangeMode(dirPath) {
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
async function warnArchivedTwin(cmd, target, changesBase) {
    const archived = await scanArchivedChanges(changesBase);
    const twin = archived.find((c) => c.name === target || c.archived?.displayName === target);
    if (!twin)
        return;
    console.warn(`[openspec-tools] Serving the open change '${target}'.\n` +
        `  An archived change of the same name also exists: ${twin.name}\n` +
        `  Read it with: ${commandPath(cmd)} ${twin.name}\n`);
}
async function resolveMode(cmd, target) {
    if (!target)
        return resolveDefaultMode(cmd);
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
            await warnArchivedTwin(cmd, target, changesBase);
            return { kind: "change", changeName: target, dirPath: asChange };
        }
        // Archived directory name, date prefix and all.
        if (isDirectory(asArchived))
            return archivedChangeMode(asArchived);
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
        return reportTargetNotFound(cmd, target, [abs, asChange, asArchived], changesBase);
    }
    const stat = statSync(abs);
    if (stat.isFile()) {
        if (!abs.endsWith(".md")) {
            usageError(cmd, `Not a Markdown file: ${displayPath(abs)}`, [
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
    return usageError(cmd, `Unsupported target type: ${displayPath(abs)}`, [""]);
}
/**
 * The reading capability as a subcommand. Under an explicit verb every
 * positional word is a target, so no name has to be reserved and intercepted.
 */
export function readCommand() {
    return new Command("read")
        .description("serve OpenSpec changes as read-aloud-friendly web pages")
        .argument("[target]", `change name, folder, or .md file (default: ${DEFAULT_CHANGES_DIR}/)`)
        .option("-p, --port <n>", "listen on this exact port, overriding the automatic choice", parsePort)
        .option("-o, --open", "open browser automatically", false)
        .option("-a, --archived", "include archived changes", false)
        .addHelpText("after", `
TARGET
  (none)              List all open changes in ${DEFAULT_CHANGES_DIR}/
  <change-name>       Serve a specific change (name or path)
  <archived-name>     Serve an archived change, with or without its date prefix
  ${DEFAULT_CHANGES_DIR}/archive
                      List the archived changes
  <folder>            Serve all .md files in a folder
  <file.md>           Serve a single Markdown file

  Every word here is a target. No name is reserved: a change named 'help'
  or 'skill' is served by name, like any other.

EXAMPLES
  opsx-tools read                          # list open changes
  opsx-tools read --archived               # list open and archived changes
  opsx-tools read add-dark-mode            # read a change
  opsx-tools read 2026-08-10-add-dark-mode # read an archived change
  opsx-tools read ./docs                   # serve a docs folder
  opsx-tools read CONTRIBUTING.md -o       # open a file in browser
  opsx-tools read -p 8080                  # pin the port instead

PORT
  Chosen automatically when --port is omitted: each project gets its own
  port in ${PORT_RANGE_START}-${PORT_RANGE_END}, derived from the project root, so the same project keeps
  the same URL across restarts and several readers can run side by side.
  If that port is taken, the next free one is used and the swap is announced.
  --port is never substituted: a busy port is reported as an error instead.
`)
        .action(async (target, options, command) => {
        const mode = await resolveMode(command, target);
        const opts = {
            requestedPort: options.port,
            project: resolveProject(),
            mode,
            openBrowser: options.open,
            archived: options.archived,
        };
        await startServer(opts);
    });
}
//# sourceMappingURL=cli.js.map