# openspec-tools

An **[OpenSpec](https://github.com/Fission-AI/OpenSpec)** extension package with two components:

1. **`opsx-read`** — a lightweight CLI + web server that renders OpenSpec changes as clean, read-aloud-friendly HTML pages (great with browser Read Aloud, Edge Immersive Reader, etc.)
2. **`openspec-review`** — a skill that reviews a change for internal consistency, alignment with existing specs, and code conformance

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

# Serve any folder of Markdown files
opsx-read ./docs

# Serve a single file, open browser automatically
opsx-read CONTRIBUTING.md --open
```

Then open `http://localhost:4242` in your browser and use **Read Aloud** (Edge, Chrome, Safari, etc.) to listen to the spec while you code.

### Options

| Flag | Default | Description |
|---|---|---|
| `-p, --port <n>` | `4242` | Port to listen on |
| `-o, --open` | `false` | Open browser automatically |
| `-h, --help` | — | Show help |

### Target resolution

| What you type | What gets served |
|---|---|
| *(nothing)* | All open changes in `openspec/changes/` |
| `<change-name>` | That change's folder: `openspec/changes/<name>/` |
| `<relative-path/to/folder>` | All `.md` files in that folder |
| `<relative-path/to/file.md>` | That single file |

---

## Install the review skill

Copy the skill directory into your AI tool's skills folder.

**Claude Code:**
```bash
cp -r skills/openspec-review .claude/skills/
```

**Cursor:**
```bash
cp -r skills/openspec-review .cursor/skills/
```

**Other tools:** see the [OpenSpec supported tools docs](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md) for the right path.

After copying, run `openspec update` in your project to refresh the AI instructions.

### Using the review skill

In your AI assistant's chat:

```
/opsx:review
```

Reviews the currently active change — reads all artifacts, cross-validates them, checks alignment with existing specs, validates code if already written, and outputs a structured **Review Report** with issues categorized as blocking or non-blocking.

You can also pass a change name explicitly:

```
/opsx:review add-dark-mode
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
`opsx-read` lands on your `PATH` right away.

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
│   ├── cli.ts          # Entry point, argument parsing
│   ├── server.ts       # HTTP server and routing
│   ├── scanner.ts      # Reads openspec/ directory structure
│   ├── renderer.ts     # Markdown → read-aloud HTML
│   └── types.ts        # Shared types
├── skills/
│   └── openspec-review/
│       └── SKILL.md    # The review skill (install manually)
└── README.md
```

---

## Community

This is a community extension for OpenSpec. It is not affiliated with or maintained by Fission-AI.

Contributions welcome — open an issue or PR.
