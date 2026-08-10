## Why

`opsx-read` dead-ends on bad input: `opsx-read teste` prints `Path not found: /cwd/teste` and stops, never mentioning that `--help` exists or that a second lookup under `openspec/changes/` was also attempted and also failed. Worse, the hand-rolled parser in `src/cli.ts` silently swallows any unrecognized flag, so `opsx-read --version` starts a web server on port 4242 and `opsx-read --prot 8080` reports a missing *path* for a mistyped *option*. A user who mistypes anything gets a message that is terse, incomplete, or actively misleading.

## What Changes

- **Replace the hand-rolled argument parser with `commander` (v15)** as the CLI framework. It is the de-facto standard for TypeScript/Node CLIs and ships with zero runtime dependencies of its own, so it does not compromise the project's lean install. It provides unknown-option rejection, typo suggestions, `--version`, and a `help` subcommand as built-ins rather than as hand-maintained code.
- **Every error path points to `--help`.** No error exits without telling the user how to get usage.
- **Unknown options are an error, not a no-op.** `opsx-read --prot 8080` exits non-zero with `unknown option '--prot'` plus a `Did you mean --port?` suggestion, instead of dropping the flag and misinterpreting `8080` as a target.
- **`-v, --version`** prints the version from `package.json`. **BREAKING** relative to current behavior: `--version` today starts a server; after this change it prints a version and exits.
- **`opsx-read help`** works as a bare subcommand, equivalent to `--help`.
- **Target-not-found errors report every location tried**, both `./<target>` and `./openspec/changes/<target>`, instead of only the first.
- **Target-not-found errors suggest near-matching change names** when open changes exist, and state plainly that there are none when `openspec/changes/` is empty or holds only `archive/`.
- **The empty-changes case is explained rather than silently served.** Running with no target where no open changes exist currently serves an empty page after a warning.

Out of scope: the HTTP server, the Markdown renderer, and the read-aloud HTML output. This change is confined to the CLI invocation surface.

## Capabilities

### New Capabilities

- `cli-interface`: The command-line invocation surface of `opsx-read` — option parsing, target resolution, help and version output, error messages, and exit codes. This is the first spec in the project, so it establishes the top-level `specs/` layout; the server and renderer remain unspecified and can be added as sibling capabilities later.

### Modified Capabilities

None. The project has no existing specs under `openspec/specs/`.

## Impact

- **`src/cli.ts`** — `parseArgs` and `resolveMode` are restructured around `commander`. `resolveMode` gains the ability to enumerate open changes for suggestions, which requires either a synchronous directory read or making the entry path async; that trade-off is a design decision, not settled here.
- **`src/scanner.ts`** — `scanChanges` is async while the current error path is synchronous. Either it gains a sync counterpart or the caller adapts. No behavior change to scanning itself.
- **`package.json`** — adds `commander` as the second runtime dependency (after `marked`), and the CLI reads `version` from it for `--version`.
- **`dist/`** — is committed so that `npm install -g github:...` needs no build step, so the recompiled output must be committed alongside the source.
- **README.md** — the options table (`-p`, `-o`, `-h`) and the target-resolution table need `--version` and the `help` subcommand added.
- **No change** to `src/server.ts`, `src/renderer.ts`, or `src/types.ts` beyond whatever `ServerOptions` shape the new parser produces.
