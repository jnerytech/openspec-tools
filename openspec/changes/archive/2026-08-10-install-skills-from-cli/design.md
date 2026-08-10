## Context

See proposal.md — Why. Three facts about the current package shape constrain
the approach:

- `package.json` declares no `files` field, so `skills/` is published and is
  present in a global install. Verified: a global install of this package at
  `<npm root -g>/openspec-tools/` contains `skills/openspec-review-change/`.
  The installer therefore has a real source directory to copy from; it only has
  to find its own.
- `src/cli.ts` deliberately keeps `opsx-read` to one job. `help` is intercepted
  as a target rather than registered as a subcommand specifically to avoid
  adding a `Commands:` section (`src/cli.ts:328`). Skill management is a second
  job and does not belong on that surface.
- `src/project.ts` already answers "which project is this?" — nearest ancestor
  owning `openspec/`, else the repository root, with symlinks resolved. The
  reader derives its port from that value.

Two facts about the destination, from the Claude Code skills documentation:

- A skill's `/command` name comes from its **directory name**, not its `name:`
  frontmatter. `.claude/skills/openspec-review-change/` yields
  `/openspec-review-change`.
- There are four storage levels. Enterprise lives in managed settings; plugin
  skills live inside a plugin directory that is replaced wholesale when the
  plugin updates. Neither is a place a globally installed npm CLI should write.

## Goals / Non-Goals

**Goals:**
- One source of truth for what is installable: the package's own `skills/`.
- Identical behaviour from a clone and from a global install.
- No state file. Installed state is always derived from what is on disk.
- "Project" means the same thing in `opsx-skills` as in `opsx-read`.

**Non-Goals:**
- A general skill manager. See proposal.md — Non-goals.
- Version tracking or upgrade notifications. The installer answers "is this
  copy the same as mine?", not "which release is this from".
- Any change to `opsx-read`'s surface, including adding a subcommand to it.

## Decisions

### A second executable, `opsx-skills`

Alternatives: a `skills` subcommand on `opsx-read`; a single umbrella `opsx`
binary with `read` and `skills` subcommands.

The subcommand loses on two counts. It contradicts the single-job decision
already recorded in `src/cli.ts`, and it reintroduces the exact ambiguity the
`help` interception exists to avoid: a change directory named `skills` would
become unreachable as a target. The umbrella binary is the cleanest design in
the abstract, but `opsx-read` is a published command and renaming it is a
breaking change bought for cosmetics. Two `bin` entries in one package is
ordinary and costs the user one extra name.

### The source directory is resolved from the module, never from `cwd`

`fileURLToPath(import.meta.url)` gives the running module's path; the package's
`skills/` is its grandparent's `skills/`. This resolves correctly for both
`dist/skills-cli.js` and `src/skills-cli.ts` under `tsx`, since both sit one
level below the package root.

This is what makes the README's current instructions obsolete rather than
merely automated: `cp -r skills/...` requires the user to be standing in a
clone, and the resolved-from-module path does not.

### Copy, not symlink

A symlink would give perfect provenance — `readlink` proves the origin — and
would keep the installed skill current across package updates. It is rejected
because the project destination, `.claude/skills/`, is routinely committed so
a team shares it. A symlink into one developer's `~/.nvm/versions/node/...`
is meaningless in anyone else's checkout, and worse, silently so.

Using symlinks at the user level and copies at the project level was
considered and rejected: two mechanisms means two sets of failure modes, and
`remove` would have to handle both.

### Installed state comes from comparing directory contents

Alternative: write a manifest (`.opsx-skills.json`) at install time recording
what was placed where.

A manifest only knows about installs it performed. Every skill copied by hand
following the current README would be invisible to it — which is precisely the
population this change exists to rescue. Comparison has no such blind spot: it
classifies a hand-copied skill identically to an installed one.

Comparison is over the whole directory tree, not `SKILL.md` alone, because
skills may carry supporting files and scripts alongside it.

The one thing comparison cannot do is distinguish "modified by the user" from
"a different skill that happens to share the name". Both surface as *differs
from the packaged copy*, and both are handled the same way: warn, name the
path, ask. The consequence of being wrong is identical in both cases, so
distinguishing them buys nothing.

### The candidate list is closed, which is what makes removal safe

Because the installer can only name skills the package ships, it structurally
cannot offer to delete an unrelated skill. This matters concretely: this
repository's own `.claude/skills/` holds four skills from OpenSpec upstream
(`openspec-propose`, `openspec-explore`, `openspec-apply-change`,
`openspec-archive-change`), all sharing the `openspec-` prefix with the skill
this package ships. Any prefix or glob heuristic would have swept them up. An
exact-name match against a closed set cannot.

### `@inquirer/prompts` for the interactive selection

Alternatives: hand-rolled `readline/promises` (Node 20 has it built in);
`prompts`; `enquirer`.

The interaction needs a multi-select with per-item annotations and a
confirmation — a hand-rolled version of that is a few hundred lines of terminal
handling for a package whose current dependency list is two entries.
`@inquirer/prompts` is ESM-native, matching the package's `"type": "module"`,
and its `checkbox` and `confirm` primitives are exactly the two used.

### Prompts are for choices, not for facts already supplied

Every prompt has a flag equivalent, and supplying the flag skips the prompt.
When a choice is missing and cannot be prompted for — output piped, CI — the
command fails naming the flag that would have supplied it, rather than
defaulting. This follows the error stance already established in
`src/cli.ts`: pick the likely intent when there is one, and when there isn't,
say what is missing and how to supply it.

### Both destinations are offered in one selection

The interactive flow asks for skills and destinations, then shows the resulting
writes and deletions before doing anything. The bare `opsx-skills` invocation
presents skill × destination pairs directly, so both levels are visible at once
without a second screen. With a handful of skills this is one short list; if
the package ever ships enough skills to make `2N` rows unwieldy, the verbs
remain the scalable surface.

## Risks / Trade-offs

- **A user's own skill shares a name with a packaged one** → It is reported as
  differing rather than as installed, and neither overwrite nor removal happens
  without a confirmation that names the absolute path.
- **A newly created `~/.claude/skills/` is not detected until the AI tool
  restarts** → Reported at the moment the directory is created, so the user
  does not conclude the install silently failed.
- **`dist/` is committed so installs need no build step** → The new binary must
  be compiled and its output committed with the change, or a fresh
  `npm install -g` gets a `bin` entry pointing at a file that does not exist.
- **A third dependency in a deliberately small package** → Confined to the new
  binary; `opsx-read` does not import it.
- **Comparison is content equality, so an older packaged copy and a newer
  installed one both read as "differs"** → Accepted. The installer's job is to
  make the destination match what it ships; direction of drift does not change
  the action or the confirmation.

## Migration Plan

No data migration. The existing population is users who ran the README's
`cp -r`; comparison classifies their copies as already installed, so running
the installer over them is a no-op rather than a surprise.

The README's `cp -r` instructions and its `/opsx:review` command name are
corrected in this change. `/opsx:review` never existed — there is no
`commands/opsx/review.md` in this repository — so removing it from the README
breaks nothing that currently works.
