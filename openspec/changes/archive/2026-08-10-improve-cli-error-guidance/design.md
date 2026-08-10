## Context

See proposal.md — Why. The behavior contract is in `specs/cli-interface/spec.md`; this document covers only how to get there.

Constraints that shape the approach:

- `src/cli.ts` hand-rolls argument parsing in a single `for` loop whose final branch is `else if (!arg.startsWith("-"))`. There is no terminal `else`, which is the root cause of every swallowed-flag symptom in the proposal.
- `resolveMode()` is synchronous and calls `process.exit(1)` directly, while `scanChanges()` in `src/scanner.ts` is `async`. Suggesting change names from an error path therefore crosses a sync/async boundary.
- `dist/` is committed so that `npm install -g github:...` works without a build step. Any source change must ship with recompiled output.
- The package is ESM (`"type": "module"`), `tsconfig.json` sets `rootDir: ./src` and `outDir: ./dist`, and `resolveJsonModule` is not enabled.
- Runtime dependencies today are exactly one (`marked`). `@types/node` is pinned at `^20`, which is the project's implicit Node floor.

## Goals / Non-Goals

**Goals:**

- Replace the hand-rolled parser with a framework so that unknown-option rejection, suggestions, help, and version are library behavior rather than code we maintain.
- Keep every requirement in the spec satisfied by construction, not by scattered ad-hoc checks.
- Preserve the existing `ServerOptions` contract so `src/server.ts` and `src/renderer.ts` need no changes.

**Non-Goals:**

- No new options beyond `--version`. The option surface stays at port, open, help, version.
- No restructuring of target resolution semantics. The two lookup locations and the four `TargetMode` kinds stay exactly as they are; only the error reporting around them changes.
- No test framework introduction. The project has none, and adding one is a separate change.

## Decisions

### Use `commander`, pinned to v14, not v15

`commander` is the most widely used argument parser for Node CLIs, has zero runtime dependencies of its own, and covers four of the six spec requirements as built-ins. Verified against the real package rather than assumed:

| Behavior | Result |
|---|---|
| `--help` / `-h` → usage, exit 0 | built in |
| `-v, --version` (custom flags) | built in via `.version(v, "-v, --version")` |
| unknown option → `error: unknown option '--prot'`, exit 1 | built in, default |
| near-miss suggestion → `(Did you mean --port?)` | built in, default, no config |
| `opsx-read help` as a bare word | **not** provided — see below |

**Version choice matters.** `commander@15` declares `engines.node >= 22.12.0`; `commander@14` declares `>= 20`. This is a globally installed CLI, so its Node floor becomes the user's Node floor. The project already targets Node 20 via `@types/node@^20`, so v15 would raise the floor two majors for no functional gain — every behavior in the table above is present in v14. **Use `commander@^14`** and add an explicit `"engines": { "node": ">=20" }` to `package.json` so the constraint is declared rather than implied.

*Alternatives considered:* `citty` (UnJS) is lighter and ESM-native but still pre-1.0 (0.2.2) and has no built-in typo suggestion — the wrong trade for a published CLI. `cac` and `yargs` add either less ecosystem familiarity or a dependency tree. Keeping the hand-rolled parser and fixing it in place was rejected: the suggestion logic alone is more code than the migration, and it leaves the missing-`else` class of bug possible again.

### Handle `help` by intercepting the target, not by registering a subcommand

Verified: `commander` only auto-registers a `help` subcommand when the program has other subcommands. For a subcommand-less program, `opsx-read help` parses `help` as the positional target and falls through to the action.

Two fixes work. Registering `program.command("help")` is the idiomatic one, but it adds a `Commands:` section to the help output, implying `opsx-read` is a multi-command tool when it has exactly one job. **Intercept instead:** in the action handler, if the target is the literal string `help`, print usage and exit 0 before target resolution runs.

The cost is a documented edge case — a change literally named `help` becomes unreachable by bare name. That is acceptable: it is still reachable as `opsx-read openspec/changes/help`, and the collision is vanishingly unlikely. Note this in the help text rather than engineering around it.

### Route every usage error through `showHelpAfterError`

The spec requires that every usage error ends with a pointer to `--help` *and* that full usage text is not dumped in its place. `program.showHelpAfterError("Run 'opsx-read --help' for usage.")` does exactly this — passing a string prints that string instead of the full help. Verified output:

```
error: unknown option '--prot'
(Did you mean --port?)
Run 'opsx-read --help' for usage.        ← exit 1
```

This covers commander's own errors. Errors we raise ourselves — unresolvable target above all — must produce the same trailing line, so they go through a single `usageError(message, details[])` helper that writes to stderr, appends the pointer, and exits 1. One helper, one guarantee: no error path can forget the pointer.

### Make the action handler async and reuse `scanChanges()`

To suggest change names, the error path needs the list of open changes. Two ways across the sync/async boundary:

1. Add a `readdirSync`-based lister to `scanner.ts` for the error path only.
2. Make commander's action handler `async` and `await scanChanges()`.

**Take option 2.** Commander supports async action handlers, so the boundary disappears at the entry point rather than being worked around. Option 1 would duplicate the "a directory is an open change if it holds at least one `.md` and is not `archive/`" rule in two places — and that rule is exactly what the spec's archive-only scenario depends on. One definition, one place.

`scanChanges()` reads each change's markdown files, which is more work than a name list strictly needs, but it runs only on the error path over a handful of directories. Not worth a second code path.

### Read the version through `createRequire`, not a JSON import

`--version` needs the version from `package.json`. An `import ... with { type: "json" }` would require enabling `resolveJsonModule` and would pull `package.json` — which sits above `rootDir: ./src` — into the compilation, producing a `TS6059` rootDir violation and shifting the `dist/` layout. Since the layout is `src/cli.ts` → `dist/cli.js`, `../package.json` resolves to the package root from both source and build output.

Use `createRequire(import.meta.url)("../package.json")`. No tsconfig change, no layout change.

### Reuse commander's suggestion behavior for options; write a small matcher for change names

Option typos are handled by commander for free. Change-name suggestions are ours. Commander's internal `suggestSimilar` is not part of the public API, so implement a small case-insensitive edit-distance matcher in the CLI module: names within a distance of 3, or containing the target as a substring, are shown as `Did you mean`; otherwise list the available names. Both branches are spec'd scenarios, so the fallback is not optional.

## Risks / Trade-offs

- **Adding a second runtime dependency** → `commander` has zero transitive dependencies, so install weight grows by one package, not a tree. Verified against the published manifest.
- **`--version` changing behavior is technically breaking** → It currently starts a server, which no one can be relying on deliberately. Flagged as **BREAKING** in the proposal and called out in the README options table.
- **A change named `help` becomes unreachable by bare name** → Documented in the help text; the full-path form still works.
- **Committed `dist/` can drift from `src/`** → The change is not complete until `npm run compile` output is committed in the same commit. This is an existing hazard of the repo layout, not one this change introduces, but it now applies to the entry point.
- **No tests exist to lock the new behavior in** → Every spec scenario is expressed as a concrete command and observable output, so they are checkable by hand from the terminal. Introducing a test runner is deliberately left to a separate change; the risk is that a future refactor silently regresses an error message.
- **Node floor becomes explicit** → Adding `engines.node >= 20` will now warn users on Node 18 who previously installed without complaint. That is the honest state of the package; `marked` and the existing code already assume modern Node.
