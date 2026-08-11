## 1. Turn the two programs into command builders

- [x] 1.1 In `src/cli.ts`, replace the top-level `const program = new Command()` and `await program.parseAsync(process.argv)` with an exported builder that returns a configured `read` `Command`; remove `pkg` / `createRequire` and the `.version(...)` call, which move to the root
- [x] 1.2 Delete the `if (target === "help") program.help()` interception in the `read` action, and delete the `NOTE` paragraph in its help text that documents the `help` collision — both are obsolete under an explicit verb
- [x] 1.3 In `src/skills-cli.ts`, replace the top-level program construction, the `.version(...)` call, and the `try/catch` around `parseAsync` with an exported builder that returns a configured `skill` `Command` carrying `install`, `remove`, `list`, and its bare interactive action
- [x] 1.4 Move `.enablePositionalOptions()` off the skills program and onto the root, so options following a subcommand are parsed by that subcommand

## 2. Add the root entry point

- [x] 2.1 Create `src/main.ts` with the `#!/usr/bin/env node` shebang, composing `read` and `skill` via `.addCommand()`
- [x] 2.2 Give the root `.name("opsx-tools")`, a description, `.version(pkg.version, "-v, --version", ...)`, and `.showHelpAfterError(...)`
- [x] 2.3 Move the `ExitPromptError` handler from `skills-cli.ts` to wrap the root `parseAsync`, so Ctrl-C during a skill prompt still reports a cancelled invocation rather than a stack trace
- [x] 2.4 Verify the bare `opsx-tools` invocation prints usage and exits 0 — it must not start the reader, bind a port, or prompt about skills

## 3. Make usage errors point at the right help

- [x] 3.1 Replace the hardcoded `HELP_HINT` literal in both files with a hint derived from the `Command` the error occurred in, so `read` failures suggest `opsx-tools read --help` and `skill` failures suggest `opsx-tools skill --help`
- [x] 3.2 Update `requireInteractive` in `src/skills-cli.ts`: the non-interactive escape hatches it prints (`opsx-skills install <skill>...`) must name runnable `opsx-tools skill ...` invocations
- [x] 3.3 Update the two runnable commands printed in warnings in `src/cli.ts` — the archive hint (`cli.ts:147`) and the archived-twin notice (`cli.ts:188`) — to full `opsx-tools read ...` invocations

## 4. Rewire the package

- [x] 4.1 Replace the two `bin` entries in `package.json` with a single `"opsx-tools"` mapping, with no wrapper kept under either old name
- [x] 4.2 Run `npm run compile` and confirm the emitted file the `bin` entry points at actually exists in `dist/`; commit the rebuilt `dist/`
- [x] 4.3 Update every example invocation in the help text of both subcommands to the `opsx-tools <verb> ...` form

## 5. Verify against the specs

- [x] 5.1 Confirm `opsx-tools read help`, `opsx-tools read skill`, and `opsx-tools read list` resolve as targets, and that an unresolvable one reports a target error rather than an unknown command
- [x] 5.2 Confirm `opsx-tools --help`, `opsx-tools help`, `opsx-tools read --help`, and `opsx-tools skill --help` each print the right listing, and that `read --help` is not the root listing
- [x] 5.3 Confirm the error paths still behave: `opsx-tools read --prot 8080` names `--prot` and suggests `--port`; `opsx-tools read --port abc` reports a non-numeric port; `opsx-tools raed` reports an unknown command; each exits 1 without the full usage listing
- [x] 5.4 Confirm `opsx-tools skill list`, a non-interactive `opsx-tools skill install <name> --project --yes`, and a piped invocation missing a destination all behave as `skill-installation` specifies — that spec has no delta, so any change in behaviour here is a regression
- [x] 5.5 Confirm `opsx-tools read` still derives its port per project and prints the same startup banner

## 6. Documentation and completion

- [x] 6.1 Rewrite `README.md`: the two-component intro, quick start, both command reference tables, the install section's `PATH` sentence, and the `src/` listing in Project structure (including the new `main.ts` and the changed entry-point comments)
- [x] 6.2 Grep for `opsx-read` and `opsx-skills` across `src/`, `README.md`, `skills/`, `package.json`, and `openspec/specs/`; the only remaining hits must be under `openspec/changes/archive/`, which is a historical record and stays untouched
- [x] 6.3 At archive time, edit the `## Purpose` line of `openspec/specs/cli-interface/spec.md` and `openspec/specs/archive-browsing/spec.md` directly to name `opsx-tools` — a delta spec cannot change a Purpose, so this will not happen automatically
