## Context

See proposal.md — Why.

Two constraints shape the approach. First, `src/cli.ts` and `src/skills-cli.ts`
are each a complete `commander` program today: each constructs its own
`Command`, reads its own `pkg.version`, owns its own `HELP_HINT` string, and
calls `parseAsync` at module top level. Neither can be nested without being
turned inside out. Second, the invocation surface is specified in detail —
`cli-interface` alone carries a dozen requirements about help, error text, and
exit codes — so the rename is constrained to preserve every behaviour the specs
already pin down, and the specs themselves are constrained to say the same
things about a differently-spelled command.

## Goals / Non-Goals

**Goals:**

- One `bin` entry, with `read` and `skill` composed under it as `commander`
  subcommands rather than re-implemented.
- Each subcommand's help and error hints resolve to that subcommand, without
  a hand-maintained string per file.
- The behaviour behind both subcommands is byte-for-byte what it was; the diff
  touches argument wiring and printed command names, nothing else.

**Non-Goals:**

- No `opsx` alias. Reserved for the reason in Decisions, below.
- No change to `server.ts`, `renderer.ts`, `scanner.ts`, `port.ts`,
  `project.ts`, or any `skill-*` module. If a diff appears in one of those, the
  change has grown beyond its scope.
- No test harness. The project has none today, and adding one is its own change.

## Decisions

### `opsx-tools`, not `opsx`

`opsx:` is not this package's namespace. It is the prefix OpenSpec upstream
uses for its own experimental commands (`/opsx:explore`, `/opsx:propose`). This
package is a third-party extension. Claiming the bare `opsx` name on `PATH`
squats a namespace this project does not own, and collides outright if upstream
ever ships a binary by that name.

Considered and rejected:

| Option | Verdict |
|---|---|
| `opsx` | Best ergonomics, 9 characters, matches the current cost of `opsx-read`. Rejected on namespace grounds only. |
| `opsx-tool` | Singular implies the package holds one tool, which is false the moment a third capability lands. |
| `opsx-tools` | **Chosen.** Matches the npm package name, so a user who installed `openspec-tools` can guess the command. |
| Keep two binaries | Legitimate if `read` and `skill` were the end of the story. Rejected because every capability added later would claim another `PATH` name. |
| `opsx-tools` **and** an `opsx` alias in `bin` | Cheap to add, but two spellings for one command guarantee documentation drift. Left as an escape hatch if the length proves annoying in practice. |

The cost is real and worth stating plainly: `opsx-read` becomes
`opsx-tools read`, six characters and one word longer on the path used most.
That is the price of not squatting.

### `read` as a subcommand, never `--read`

A flag is a modifier of an action; a subcommand is the action. Mutually
exclusive mode flags reimplement subcommand dispatch with worse syntax and
forfeit what `commander` provides for free: per-subcommand help, per-subcommand
option grouping, and unknown-command errors. Every comparable CLI — `git`,
`docker`, `gh`, `cargo`, `kubectl` — uses subcommands.

### Mixed verb/noun levels are accepted deliberately

`read` is a verb; `skill install` is a noun followed by a verb. Levelling this
would mean either `change read <name>` — three words for the primary use case —
or flat verbs `install`/`remove`/`list` at the root, where `opsx-tools list`
becomes genuinely ambiguous between changes and skills, and `opsx-tools
install` reads as installing the package itself. The inconsistency is formal;
the alternatives cost real clarity. Singular `skill` follows the prevailing
`<noun> <verb>` convention (`gh pr create`, `docker image ls`).

### The root prints usage; reading is not the default action

Making `read` implicit would shorten the common path back to `opsx-tools
<target>`, but it would reserve `read`, `skill`, `install`, `remove`, `list`,
and `help` as words that can never name a change — the same collision the
project already documented for `help` alone, multiplied by six. The explicit
verb is what buys the clean target namespace, so it stays explicit.

### The `help` interception is deleted, not ported

`src/cli.ts:330` intercepts the literal target `help` and prints usage, because
a subcommand-less `commander` program parses `help` as a positional argument.
Under a `read` subcommand that workaround is unnecessary and actively wrong.
Verified against the installed `commander` version:

```
$ opsx-tools read help    →  target = "help"
$ opsx-tools read skill   →  target = "skill"
$ opsx-tools read list    →  target = "list"
$ opsx-tools help         →  root usage, exit via commander.help
```

`commander` registers an implicit `help` command only on a program that has
subcommands of its own. The root gets one; `read` does not. So `opsx-tools
help` works at the root and `read` sees every positional word as a target. The
limitation recorded in `improve-cli-error-guidance/design.md` — that a change
named `help` was addressable only by path — is resolved by this change rather
than carried forward.

### Structure: builders, not programs

Both entry files stop calling `parseAsync` and instead export a function
returning a configured `Command`. A new root module owns what is genuinely
program-wide: the `bin` shebang, `pkg.version`, `.showHelpAfterError`, the
`ExitPromptError` handler that currently lives at the bottom of
`skills-cli.ts`, and the single `parseAsync` call.

```
       src/main.ts                    ← the only bin
            │
      ┌─────┴─────┐
      │           │
 readCommand  skillCommand            ← builders, no parseAsync
  (cli.ts)   (skills-cli.ts)
      │           │
      │      install · remove · list
      │      (+ bare = interactive sync)
      │
  [target] -p -o -a
```

Considered: a single flat file. Rejected — it merges two unrelated 300-line
concerns and makes the diff unreadable, which defeats the goal of proving the
behaviour did not change.

Two details that will bite if missed. `enablePositionalOptions()` currently
sits on the skills program; under nesting it belongs on the root, so that
options after a subcommand are parsed by that subcommand. And the `ExitPromptError`
handler must wrap the root `parseAsync`, or a Ctrl-C during a skill prompt goes
back to being a stack trace.

### Help hints are derived, not hardcoded

`HELP_HINT` is a literal string in both files today
(`"Run 'opsx-read --help' for usage."`). The spec now requires the hint to name
the failing subcommand, and a hardcoded string cannot do that once the same
`usageError` helper serves both. The hint is derived from the `Command` the
error occurred in, so a future third subcommand gets a correct hint without
anyone remembering to add one.

## Risks / Trade-offs

- **The primary path gets longer.** `opsx-read` → `opsx-tools read`. → Accepted
  as the cost of namespace hygiene; the `bin`-alias escape hatch stays
  available if it grates in daily use.
- **The rename is mechanical and therefore easy to do incompletely** — a string
  in a warning that nobody reads until it fires, such as the archived-twin
  notice at `cli.ts:188` or the archive hint at `cli.ts:147`. → A grep for
  `opsx-read` and `opsx-skills` across `src/`, `README.md`, and `openspec/specs/`
  that returns zero outside `openspec/changes/archive/` is the completion test,
  and is listed as a task.
- **`dist/` is committed and the `bin` target moves.** A stale `dist/` means the
  installed command points at a file that no longer exists. → Recompiling is a
  task, and the `bin` path in `package.json` must be verified against what
  `tsc` actually emitted, not assumed.
- **Archived changes under `openspec/changes/archive/` quote the old names.**
  → Left alone on purpose. Archived changes are a record of what was decided
  then, not documentation of what is true now; rewriting them would falsify
  history.
- **Two live spec Purpose lines name `opsx-read`** (`cli-interface`,
  `archive-browsing`). Delta specs cannot change a Purpose. → Edited directly in
  `openspec/specs/` as part of the archive step, listed as a task, so the live
  specs do not describe a command that no longer exists.

## Migration Plan

No user migration. The CLI has no users; the old binary names are removed
outright rather than shimmed. A user with a stale global install gets both new
and old names replaced by a reinstall, since `npm install -g` rewrites the
package's `bin` links.
