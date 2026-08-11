## Why

The package ships two binaries, `opsx-read` and `opsx-skills`, that share a
project root, a version, an error-guidance stance, and a `[openspec-tools]`
prefix on every line they print — but present themselves on the user's `PATH`
as two unrelated tools. Every tool added later would claim a third name. The
hyphenated-binary shape is also the one the ecosystem spent a decade undoing:
`docker-compose` and its peers were absorbed into a parent command precisely
because a family of tools reads as a family only when it has one entry point.

Fixing this is cheapest now: the CLI has no users, so the break costs nothing
but the rename itself.

## What Changes

- **BREAKING**: `opsx-read` and `opsx-skills` are removed. The package ships a
  single binary, **`opsx-tools`**, matching the package name `openspec-tools`.
- **BREAKING**: reading is invoked as `opsx-tools read [target]`, with the same
  options and target forms `opsx-read` accepted (`-p/--port`, `-o/--open`,
  `-a/--archived`).
- **BREAKING**: skill management is invoked as `opsx-tools skill …`, with the
  same verbs `opsx-skills` accepted (`install`, `remove`, `list`) and the same
  options (`--project`, `--user`, `-y/--yes`). The verb is the **singular**
  noun `skill`, following the prevailing `<noun> <verb>` convention.
- `opsx-tools skill` with no verb keeps the interactive install/remove
  selection that a bare `opsx-skills` provided today.
- `opsx-tools` with no subcommand prints usage and exits 0. It does **not**
  default to reading, so no command word is reserved in the target namespace.
- The `help` target interception is **removed**. Under an explicit `read` verb
  a bare word is unambiguously a target, so `opsx-tools read help` serves a
  change named `help`. The limitation documented in
  `improve-cli-error-guidance` — that a change named `help` was reachable only
  by path — no longer exists.
- Usage errors point at the help of the subcommand that failed
  (`opsx-tools read --help`, `opsx-tools skill --help`), not at a single
  program-wide hint.
- **No deprecation shims.** The old names are not kept as forwarding wrappers.

Non-goals: no change to what the reader renders, how ports are derived, how
skills are compared or copied, or which destinations exist. This change moves
the invocation surface and nothing behind it.

## Capabilities

### New Capabilities

None. No new behaviour is introduced; the existing surface is re-addressed.

### Modified Capabilities

- `cli-interface`: the specification is re-scoped from the `opsx-read` program
  to the `opsx-tools` program. Every scenario that names the binary is
  restated. Three requirements change in substance rather than spelling: help
  is now addressed per subcommand as well as at the root; every usage error
  points at the help of the subcommand that failed rather than at one
  program-wide hint; and `help` as a bare word after `read` is an ordinary
  target rather than a reserved command. Three requirements are added, covering
  the single-binary shape, the informational bare invocation, and the freed
  target namespace.
- `archive-browsing`: two references to `opsx-read` — the purpose statement and
  the default-invocation scenario — name a command that will not exist. The
  archive behaviour itself is unchanged; the invocations are restated.

`skill-installation` and `server-startup` need no delta: both are written in
terms of "the installer" and "the reader" rather than binary names, and every
requirement in them survives the rename unchanged. `change-summary` describes a
skill, not the CLI, and is untouched.

## Impact

- `package.json` — the `bin` map goes from two entries to one, `opsx-tools`,
  pointing at a new root entry point.
- `src/cli.ts` — stops being a program and becomes a `read` command builder;
  the `help` interception and the hardcoded `HELP_HINT` are removed.
- `src/skills-cli.ts` — stops being a program and becomes a `skill` command
  builder; the top-level `--version`, the `ExitPromptError` handler, and the
  hardcoded `HELP_HINT` move to the root.
- New root entry point that composes both, owns `--version`, and owns the
  cancelled-prompt handling.
- `README.md` — roughly thirty invocations, the quick start, the command
  reference tables, the install section, and the project-structure listing.
- `dist/` is committed and must be recompiled, since the `bin` target changes.
- No change to `src/server.ts`, `src/renderer.ts`, `src/scanner.ts`,
  `src/port.ts`, `src/project.ts`, or any `skill-*` module.
