# Chapter 2: Quickstart, Scope & Storage Locations

## Core Idea
Subagents are Markdown files with YAML frontmatter. Where you store the file decides its scope; when two share a `name`, the higher-priority location wins. Use `/agents` for guided creation, or write files / pass JSON for automation.

## Frameworks Introduced
- **The scope priority ladder**: managed > CLI flag > project > user > plugin. Higher priority overrides same-named lower ones.
  - When to use: pick the lowest scope that still reaches everyone who needs it.
  - How: drop the file in the matching directory (see table).
- **The `/agents` command**: tabbed UI. **Running** tab = live/recent subagents (open or stop). **Library** tab = view all, create (guided or Claude-generated), edit config/tools, delete, see which wins on duplicates. Recommended way to create/manage.

## Key Concepts
- **Project subagent** (`.claude/agents/`): codebase-specific; check into version control for the team.
- **User subagent** (`~/.claude/agents/`): personal, available in all your projects.
- **CLI-defined** (`--agents` JSON): session-only, not saved to disk; good for testing/automation.
- **Managed subagent**: deployed by org admins via managed settings dir; precedence over project + user.
- **Plugin subagent**: from installed plugins; appears in `/agents`; lowest priority.
- **Identity = `name` frontmatter only**: subfolder path does NOT change identity (except plugins — see below).

## Reference Tables
| Location | Scope | Priority | Create via |
| --- | --- | --- | --- |
| Managed settings | Organization-wide | 1 (highest) | Managed settings deploy |
| `--agents` CLI flag | Current session | 2 | JSON at launch |
| `.claude/agents/` | Current project | 3 | Interactive or manual |
| `~/.claude/agents/` | All your projects | 4 | Interactive or manual |
| Plugin `agents/` dir | Where plugin enabled | 5 (lowest) | Installed with plugin |

## Discovery rules (precise)
- **Project scope** is found by walking up from CWD to repo root; every `.claude/agents/` between is scanned. As of v2.1.178, nearest-to-CWD wins on duplicate `name`.
- `--add-dir` directories are also scanned (their `.claude/agents/` loads alongside project subagents).
- Both project and user dirs are scanned **recursively** — organize into `agents/review/`, `agents/research/`. Subfolder does not affect identity.
- **Duplicate `name` within one scope** → one kept, the other discarded *silently*. Keep names unique tree-wide.
- **Plugin subfolders DO matter**: `agents/review/security.md` in plugin `my-plugin` registers as scoped id `my-plugin:review:security`.

## Code Examples
Define multiple session-only subagents with `--agents` (macOS/Linux/WSL):
```shellscript
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer. Focus on code quality, security, and best practices.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  },
  "debugger": {
    "description": "Debugging specialist for errors and test failures.",
    "prompt": "You are an expert debugger. Analyze errors, identify root causes, and provide fixes."
  }
}'
```
- **What it demonstrates**: `--agents` JSON accepts the same fields as file frontmatter; `prompt` = the system prompt (markdown body equivalent).

## Worked Example
You want a `code-reviewer` available everywhere but a stricter project-specific one for repo X:
1. Put the general one in `~/.claude/agents/code-reviewer.md` (user scope, priority 4).
2. Put the strict one in `repoX/.claude/agents/code-reviewer.md` (project scope, priority 3).
3. Inside repoX, the project file wins (higher priority). Elsewhere, the user file is used. Same `name`, resolved by location.

## Anti-patterns
- **Reusing a `name` within one scope**: one definition is dropped with no warning.
- **Relying on subfolder name as identity** (non-plugin): ignored — only `name` counts.
- **Editing a file on disk and expecting it live immediately**: file edits need a session restart (see Ch 3).

## Key Takeaways
1. Scope = directory; conflicts resolved by priority ladder (managed wins, plugin loses).
2. `/agents` Library tab is the recommended create/manage path.
3. Project subagents → commit them so the team shares.
4. `name` is the sole identity (plugins add subfolder to scoped id).
5. `--agents` JSON = ephemeral session subagents for testing/automation.

## Connects To
- **Ch 3**: frontmatter field reference (same fields used by `--agents`).
- **Ch 8**: plugin subagents drop `hooks`/`mcpServers`/`permissionMode`.
- **Ch 9**: scoped names appear in @-mention typeahead.
