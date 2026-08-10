#!/usr/bin/env node
import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { startServer } from "./server.js";
const DEFAULT_PORT = 4242;
const DEFAULT_CHANGES_DIR = "openspec/changes";
function parseArgs(argv) {
    const args = argv.slice(2);
    let port = DEFAULT_PORT;
    let openBrowser = false;
    const positionals = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--port" || arg === "-p") {
            port = parseInt(args[++i] ?? "", 10);
            if (isNaN(port)) {
                console.error("Invalid port number.");
                process.exit(1);
            }
        }
        else if (arg === "--open" || arg === "-o") {
            openBrowser = true;
        }
        else if (arg === "--help" || arg === "-h") {
            printHelp();
            process.exit(0);
        }
        else if (!arg.startsWith("-")) {
            positionals.push(arg);
        }
    }
    const mode = resolveMode(positionals[0]);
    return { port, mode, openBrowser };
}
function resolveMode(target) {
    if (!target) {
        // Default: openspec/changes/
        const changesDir = resolve(process.cwd(), DEFAULT_CHANGES_DIR);
        if (!existsSync(changesDir)) {
            console.warn(`[openspec-tools] Warning: ${DEFAULT_CHANGES_DIR}/ not found in current directory.\n` +
                `  Run this command from your project root, or specify a target:\n` +
                `  opsx-read <change-name|folder|file.md>\n`);
        }
        return { kind: "changes", changesDir };
    }
    const abs = resolve(process.cwd(), target);
    if (!existsSync(abs)) {
        // Maybe it's a change name (relative to openspec/changes/)
        const asChange = resolve(process.cwd(), DEFAULT_CHANGES_DIR, target);
        if (existsSync(asChange) && statSync(asChange).isDirectory()) {
            return { kind: "change", changeName: target, dirPath: asChange };
        }
        console.error(`[openspec-tools] Path not found: ${abs}`);
        process.exit(1);
    }
    const stat = statSync(abs);
    if (stat.isFile()) {
        if (!abs.endsWith(".md")) {
            console.error("[openspec-tools] File must be a .md file.");
            process.exit(1);
        }
        return { kind: "file", filePath: abs };
    }
    if (stat.isDirectory()) {
        // Is it an openspec change directory? (contains openspec-specific files)
        const changesBase = resolve(process.cwd(), DEFAULT_CHANGES_DIR);
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
    console.error("[openspec-tools] Unsupported target type.");
    process.exit(1);
}
function printHelp() {
    console.log(`
opsx-read — serve OpenSpec changes as read-aloud-friendly web pages

USAGE
  opsx-read [target] [options]

TARGET
  (none)              List all open changes in openspec/changes/
  <change-name>       Serve a specific change (name or path)
  <folder>            Serve all .md files in a folder
  <file.md>           Serve a single Markdown file

OPTIONS
  -p, --port <n>      Port to listen on (default: ${DEFAULT_PORT})
  -o, --open          Open browser automatically
  -h, --help          Show this help

EXAMPLES
  opsx-read                          # list open changes
  opsx-read add-dark-mode            # read a change
  opsx-read ./docs                   # serve a docs folder
  opsx-read CONTRIBUTING.md -o       # open a file in browser
  opsx-read -p 8080                  # custom port
`);
}
const opts = parseArgs(process.argv);
startServer(opts);
//# sourceMappingURL=cli.js.map