## Why

The package ships a skill in `skills/` but has no way to install it. The README
tells the user to run `cp -r skills/openspec-review-change .claude/skills/`,
which only works from a clone — and the documented install path is
`npm install -g github:jnerytech/openspec-tools`, after which `skills/` lives
inside the global `node_modules` and is nowhere near the user's working
directory. So today the recommended installation method does not work for
anyone who installed the recommended way.

Removal is worse: a hand-copied skill leaves no trace of where it came from, so
uninstalling means knowing the exact path and deleting a directory by hand.

## What Changes

- Add a second executable, `opsx-skills`, that installs and removes the skills
  this package ships. It reads them from its own package directory, so it works
  identically from a clone and from a global install.
- Two destinations, both offered interactively when not given as flags: the
  **project** (`<project-root>/.claude/skills/`) and the **user**
  (`~/.claude/skills/`). The project root is resolved with the same rule the
  reader already uses to derive its port, so "project" means one thing across
  both commands.
- Three verbs — `install`, `remove`, `list` — plus a bare `opsx-skills` that
  shows the current state at both destinations as an editable selection:
  checking installs, unchecking removes.
- Installed state is reported per skill and per destination by comparing the
  installed copy against the one the package ships: absent, installed,
  out of date, or locally modified. No manifest file is written.
- Removing a locally modified skill, and overwriting one, both warn and ask
  before touching anything. `--yes` skips the confirmation for scripts.
- Correct the README: replace the `cp -r` instructions with `opsx-skills`, and
  drop the `/opsx:review` command name it currently advertises. The skill's
  command name comes from its directory, so the skill is invoked as
  `/openspec-review-change`; no such command as `/opsx:review` exists.

## Capabilities

### New Capabilities
- `skill-installation`: how the packaged skills are discovered, where they may
  be installed, how installed state is determined, and how installing and
  removing are confirmed and reported.

### Modified Capabilities
<!-- None. `cli-interface` defines the invocation surface of `opsx-read`, which
     this change does not alter: `opsx-skills` is a separate executable with its
     own surface, specified under the new capability. -->

## Impact

- `package.json`: a second `bin` entry, and a prompt dependency for the
  interactive selection (the package currently has `commander` and `marked`).
- New source modules for locating the packaged skills, resolving destinations,
  comparing installed against packaged, and the command surface itself.
  `src/project.ts` is reused unchanged for project-root resolution.
- `README.md`: install and usage sections for the skill, and the removal of the
  `/opsx:review` name.
- No change to `opsx-read`, the server, the renderer, or the scanner.

## Non-goals

- Managing skills this package does not ship. The candidate list is exactly the
  contents of the package's own `skills/`, which is what keeps the tool from
  ever offering to delete an unrelated skill that happens to sit in the same
  directory.
- Installing to the enterprise or plugin levels. Enterprise skills live in
  managed settings that a globally installed CLI has no business writing to,
  and a plugin's `skills/` directory is replaced whenever the plugin updates.
- Installing command files under `.claude/commands/`. A skill directory already
  provides its own `/command`, so a command file would only add a second name
  and a second copy of the same content to maintain.
