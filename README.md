# openspec-tools

An **[OpenSpec](https://github.com/Fission-AI/OpenSpec)** extension package with two components:

1. **`opsx-read`** — a lightweight CLI + web server that renders OpenSpec changes as clean, read-aloud-friendly HTML pages (great with browser Read Aloud, Edge Immersive Reader, etc.)
2. **`openspec-review-change`** — a skill that reviews a change for internal consistency, alignment with existing specs, code conformance, and independent verification of the factual claims the change makes, installed and removed with the **`opsx-skills`** command that ships alongside it

---

## Quick start

```bash
# Install globally, straight from GitHub
npm install -g github:jnerytech/openspec-tools

# Go to your project root (where openspec/ lives)
cd your-project

# List all open changes
opsx-read

# Read a specific change
opsx-read add-dark-mode

# List open changes plus the archived ones
opsx-read --archived

# Serve any folder of Markdown files
opsx-read ./docs

# Serve a single file, open browser automatically
opsx-read CONTRIBUTING.md --open

# Install the review skill into this project
opsx-skills install openspec-review-change --project
```

The command prints the URL it bound, along with the project and what it is
reading:

```
  openspec-tools  →  http://localhost:4849
  project: openspec-tools  ·  reading: openspec/changes/
```

Open that URL in your browser and use **Read Aloud** (Edge, Chrome, Safari, etc.) to listen to the spec while you code.

### Ports

Each project gets its own port, derived from the project root — the nearest
folder owning `openspec/`, or the repository root. So:

- The same project always lands on the same URL, restart after restart, and a
  browser tab stays valid. Nothing is written to disk to achieve it.
- Readers for different projects run side by side without you assigning ports.
  Each names its project on startup and in the page title.
- The port does not depend on which subdirectory you ran the command from.

Ports are chosen from `4242`–`4999`. If the derived one is busy, the next free
port in the range is used and the substitution is announced. `--port` overrides
the choice and is never substituted: if that exact port is taken, the command
says so and stops.

> **Note:** `opsx-read` no longer listens on `4242` by default. Pass
> `--port 4242` if something depends on that address.

### Options

| Flag | Default | Description |
|---|---|---|
| `-p, --port <n>` | *derived from the project* | Listen on this exact port |
| `-o, --open` | `false` | Open browser automatically |
| `-a, --archived` | `false` | Include archived changes on the first page load |
| `-h, --help` | — | Show help |
| `-v, --version` | — | Print the version and exit |

`opsx-read help` works too, as a bare word.

Mistyped flags are rejected rather than ignored, and every error tells you
where to go next:

```
$ opsx-read --prot 8080
error: unknown option '--prot'
(Did you mean --port?)
Run 'opsx-read --help' for usage.
```

### Target resolution

| What you type | What gets served |
|---|---|
| *(nothing)* | All open changes in `openspec/changes/` |
| `<change-name>` | That change's folder: `openspec/changes/<name>/` |
| `<archived-name>` | That archived change, named with or without its `YYYY-MM-DD-` prefix |
| `openspec/changes/archive` | A list of the archived changes |
| `<relative-path/to/folder>` | All `.md` files in that folder |
| `<relative-path/to/file.md>` | That single file |

If a target can't be resolved, the error lists every location that was tried
and suggests the change names that look closest — archived ones are marked as
archived so they aren't mistaken for open work.

When a name matches both an open and an archived change, the open one is
served and the archived twin is named on stderr.

> `help` is read as a command, not a target. A change actually named `help`
> must be addressed by path: `opsx-read openspec/changes/help`.

### Archived changes

Archived changes never appear unless you ask for them — there is no fallback
to the archive when the open set is empty.

- `--archived` decides whether the **first** page load includes them.
- The index carries a **Show / Hide archived changes** link that flips the
  state per request, so revealing history costs a reload, not a restart.
- They render in their own section below the open changes, newest first, each
  showing the archive date read from its directory name. A directory without a
  valid `YYYY-MM-DD-` prefix is still listed, just without a date.
- An archived change page is labelled as archived, with its date, so an old
  task list isn't read as pending work.

> **Breaking in this release:** `opsx-read openspec/changes/archive` used to
> serve one page merging every archived change's artifacts. It now serves the
> archive as a list of archived changes, each addressable on its own.

---

## Install the review skill

The package ships a second command, **`opsx-skills`**, that installs and removes
the skills this package ships. It reads them from its own installed package, so
it works the same from a global install as from a clone — you never have to be
standing in a checkout.

```bash
# Show the current state and edit it: check to install, clear to remove
opsx-skills

# Install into this project — <project-root>/.claude/skills/
opsx-skills install openspec-review-change --project

# Install for every project you work on — ~/.claude/skills/
opsx-skills install openspec-review-change --user

# Remove it again
opsx-skills remove openspec-review-change --project
```

After installing, run `openspec update` in your project to refresh the AI
instructions.

### Destinations

| Flag | Where it writes |
|---|---|
| `--project` | `<project-root>/.claude/skills/` |
| `--user` | `~/.claude/skills/` |

Both can be given in one invocation, and each result is reported on its own
line. The project root is the same one `opsx-read` derives its port from — the
nearest folder owning `openspec/`, else the repository root — so "project"
means one thing across both commands, whichever subdirectory you ran from.

Neither flag given? You are asked. A destination is never assumed. If the
skills directory doesn't exist yet it is created, and the command says so —
a skills directory that did not exist when your AI tool started is only picked
up after the tool restarts.

### Commands

| Command | What it does |
|---|---|
| `opsx-skills` | Lists every skill at both destinations with its current state, as a checklist you edit. Checking installs, clearing removes; the writes and deletions are named and confirmed before anything happens. |
| `opsx-skills list [skills...]` | Reports each skill's state at each destination, changing nothing |
| `opsx-skills install [skills...]` | Copies skills into the chosen destinations |
| `opsx-skills remove [skills...]` | Deletes installed copies, after naming every path it will delete |
| `-y, --yes` | Answers every confirmation affirmatively, for scripts. Changes only whether you are asked — never what is written or deleted. |

Omit the skill names and you are asked which ones; name them and you aren't.

State comes from comparing what is installed against what the package ships,
not from a manifest — so a skill you copied into place by hand years ago is
recognized as installed, and one you edited is reported as *differs from the
packaged copy* rather than silently overwritten. Overwriting or deleting a
differing copy always names the absolute path and asks first.

Only the skills this package ships can be installed or removed. A skill
directory sitting at a destination that this package does not ship is never
listed, offered, or deleted — this repository's own `.claude/skills/` holds
several OpenSpec skills sharing the `openspec-` prefix, and `opsx-skills`
cannot touch them.

When a question can't be asked — piped input, CI — the command says which flag
would have supplied the answer and exits 1, rather than guessing a destination:

```
$ opsx-skills install openspec-review-change < /dev/null
[openspec-tools] A destination must be supplied when input is not a terminal.
  --project   the project's .claude/skills/
  --user      ~/.claude/skills/
Run 'opsx-skills --help' for usage.
```

**Other tools:** `opsx-skills` writes to the Claude Code paths. For anything
else, see the [OpenSpec supported tools docs](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)
for the right directory and copy `skills/openspec-review-change` there.

### Using the review skill

A skill's command name comes from its directory, so in your AI assistant's chat:

```
/openspec-review-change
```

Reviews the currently active change — reads all artifacts, cross-validates them, checks alignment with existing specs, validates code if already written, and outputs a structured **Review Report** with issues categorized as blocking or non-blocking.

You can also pass a change name explicitly:

```
/openspec-review-change add-dark-mode
```

---

## Install

```bash
# Latest from the default branch
npm install -g github:jnerytech/openspec-tools

# Pin to a tag or commit
npm install -g github:jnerytech/openspec-tools#v0.1.0

# Or with the full URL
npm install -g git+https://github.com/jnerytech/openspec-tools.git
```

The compiled `dist/` is committed, so the install needs no build step —
`opsx-read` and `opsx-skills` land on your `PATH` right away.

Requires **Node 20 or newer**.

To update later, run the same command again.

---

## Build from source

```bash
git clone https://github.com/jnerytech/openspec-tools
cd openspec-tools
npm install
npm run compile

# Run without installing globally
node dist/cli.js
```

> The compile script is deliberately **not** named `build`. npm 11 gives
> packages with a `build` script special handling when installing from a git
> ref: instead of packing the package it links it to a temporary clone under
> `~/.npm/_cacache/tmp/`, which is then cleaned up — leaving a dangling `bin`
> symlink and a `command not found`. Renaming the script avoids that path.

---

## Project structure

```
openspec-tools/
├── src/
│   ├── cli.ts                 # opsx-read entry point, argument parsing
│   ├── server.ts              # HTTP server, port binding, routing
│   ├── project.ts             # Resolves the project root and its name
│   ├── port.ts                # Derives a project's port from its root
│   ├── scanner.ts             # Reads openspec/ directory structure
│   ├── renderer.ts            # Markdown → read-aloud HTML
│   ├── skills-cli.ts          # opsx-skills entry point, prompts
│   ├── skill-source.ts        # Finds the packaged skills, from the module
│   ├── skill-destinations.ts  # The project and user skills directories
│   ├── skill-state.ts         # Installed vs packaged, by comparison
│   ├── skill-actions.ts       # Copying and deleting, with confirmation
│   └── types.ts               # Shared types
├── skills/
│   └── openspec-review-change/
│       ├── SKILL.md    # The review skill (install with opsx-skills)
│       └── references/ # Loaded on demand during a review
│           ├── claim-verification.md
│           ├── openspec-conventions.md
│           └── report-template.md
└── README.md
```

---

## Community

This is a community extension for OpenSpec. It is not affiliated with or maintained by Fission-AI.

Contributions welcome — open an issue or PR.
