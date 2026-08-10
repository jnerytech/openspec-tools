## 1. Dependency and package metadata

- [x] 1.1 Add `commander@^14` to `dependencies` in `package.json` (not `^15` — see design.md, "Use `commander`, pinned to v14")
- [x] 1.2 Add `"engines": { "node": ">=20" }` to `package.json`
- [x] 1.3 Run `npm install` and confirm `commander` resolves to a 14.x version with no transitive dependencies

## 2. Parser migration in `src/cli.ts`

- [x] 2.1 Replace the hand-rolled `parseArgs` loop with a `commander` `Command` declaring `.name("opsx-read")`, `.description(...)`, and `.argument("[target]", ...)`
- [x] 2.2 Port the existing options: `-p, --port <n>` (default 4242) and `-o, --open`
- [x] 2.3 Validate `--port` through commander so a non-numeric value is a usage error, preserving today's exit-1 behavior
- [x] 2.4 Register `.version(pkg.version, "-v, --version")`, reading `pkg` via `createRequire(import.meta.url)("../package.json")`
- [x] 2.5 Port the existing `printHelp()` content into commander via `.addHelpText("after", ...)` so the EXAMPLES block survives the migration
- [x] 2.6 Note in the help text that a change literally named `help` must be addressed by path
- [x] 2.7 Confirm the action handler still produces the same `ServerOptions` shape and that `startServer` is called unchanged

## 3. Error reporting

- [x] 3.1 Add `.showHelpAfterError("Run 'opsx-read --help' for usage.")` to the program
- [x] 3.2 Write a single `usageError(message, details?)` helper that writes to stderr, appends the same `--help` pointer line, and exits 1
- [x] 3.3 Route every hand-written error in `resolveMode` through `usageError` — no direct `console.error` + `process.exit` pairs left in the file
- [x] 3.4 Rewrite the target-not-found message to name the target as typed and list both attempted locations, `./<target>` and `./openspec/changes/<target>`

## 4. Target resolution and suggestions

- [x] 4.1 Make the commander action handler `async` so the error path can `await scanChanges()`
- [x] 4.2 Intercept the literal target `help` before resolution and print usage with exit 0
- [x] 4.3 Add a case-insensitive edit-distance matcher (distance ≤ 3, or target is a substring of the name) for open change names
- [x] 4.4 On target-not-found, append `Did you mean` with close matches; when none are close, list all open change names; when there are none, state that there are no open changes
- [x] 4.5 On no-target invocation, report the changes directory that was read and state when it holds no open changes, then start the server anyway
- [x] 4.6 Confirm a directory holding only `archive/` is reported as having no open changes

## 5. Verification against the spec

Each item is one command from `specs/cli-interface/spec.md`; run it and check the stated observable outcome.

- [x] 5.1 `opsx-read --help`, `opsx-read -h`, `opsx-read help` — usage on stdout, exit 0, no server
- [x] 5.2 `opsx-read --version` and `opsx-read -v` — version on stdout, exit 0, no server started and no port bound
- [x] 5.3 `opsx-read --bananas` — stderr names the option, exit 1, no server
- [x] 5.4 `opsx-read --prot 8080` — error names `--prot`, suggests `--port`, and does **not** mention `8080` as a missing path
- [x] 5.5 `opsx-read teste` — error names `teste` and lists both attempted locations, exit 1
- [x] 5.6 `opsx-read teste` with at least one open change present — close match suggested, or all open change names listed
- [x] 5.7 `opsx-read` in this repo (only `archive/` present) — reports no open changes and still serves
- [x] 5.8 `opsx-read` outside an OpenSpec project — reports the missing directory, points to `--help`, and still serves
- [x] 5.9 Confirm no error path prints the full usage listing alongside its message

## 6. Docs and build output

- [x] 6.1 Add `-v, --version` to the README options table and document the `help` subcommand
- [x] 6.2 Note the Node 20 floor in the README install section
- [x] 6.3 Run `npm run compile` and commit the regenerated `dist/` in the same commit as the source change
- [x] 6.4 Verify the built entry point end to end with `node dist/cli.js --help` and `node dist/cli.js --prot 8080`
