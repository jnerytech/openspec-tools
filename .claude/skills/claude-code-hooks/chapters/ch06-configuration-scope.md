# Chapter 6: Configuration & Scope

## Core Idea
Where you place a `hooks` block determines its scope and shareability — from machine-global to single-project to org-wide managed policy — and managed/policy hooks can't be disabled by users.

## Frameworks Introduced
- **Scope-by-location**: the settings file you edit picks the scope.
  - When to use: decide global vs. project vs. shared vs. enforced.
  - How: pick from the location table below.
- **Component-attached hooks**: hooks can live in plugin `hooks/hooks.json`, or in skill/agent frontmatter — active only while that component is.
  - When to use: bundle a hook with the thing it supports.
  - How: define it in the plugin manifest or component file.

## Key Concepts
- **`disableAllHooks`**: settings flag to turn off hooks in that file's scope. Managed hooks still run unless `disableAllHooks` is **also** set in managed settings.
- **`$CLAUDE_PROJECT_DIR`**: env var for referencing project-relative scripts in commands (absolute path safety).
- **File watcher**: editing settings while running normally auto-reloads hooks; restart if a change doesn't appear.
- **`/hooks` menu**: browse all configured hooks grouped by event (read-only).

## Mental Models
- Think of scopes as a precedence stack: **managed policy > project > local > user** for enforcement — managed always wins and can't be user-bypassed.
- Commit `.claude/settings.json` to share team hooks; keep machine-specific or secret ones in `.claude/settings.local.json` (gitignored) or `~/.claude/settings.json`.

## Anti-patterns
- **Relative script paths**: cause "command not found." Use `${CLAUDE_PROJECT_DIR}` or absolute paths.
- **Expecting managed hooks to obey local `disableAllHooks`**: they don't — must be disabled in managed settings.
- **Putting secrets in committed `.claude/settings.json`**: use local/user scope instead.

## Reference Tables
| Location | Scope | Shareable |
| --- | --- | --- |
| `~/.claude/settings.json` | all your projects | No (local to machine) |
| `.claude/settings.json` | single project | Yes (commit to repo) |
| `.claude/settings.local.json` | single project | No (gitignored) |
| Managed policy settings | org-wide | Yes (admin-controlled) |
| Plugin `hooks/hooks.json` | when plugin enabled | Yes (bundled w/ plugin) |
| Skill / agent frontmatter | while component active | Yes (in component file) |

## Worked Example
Team wants a shared, enforced "no edits to `.env`" guardrail plus a personal notification:
1. **Shared, committed**: add the `PreToolUse` protect-file hook to `.claude/settings.json`, with `"command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect.sh"` so the path resolves on every teammate's machine. Commit both files.
2. **Personal**: add the `Notification` hook to `~/.claude/settings.json` — only you get the desktop alert, not the team.
3. **Enforced (can't disable)**: if it must survive a user setting `disableAllHooks`, move the guardrail to **managed policy settings**; users can't bypass it by changing permission mode or disabling hooks locally.
4. Verify with `/hooks`; if the new entries don't show, restart the session to force a reload.

## Key Takeaways
1. Location = scope: user (global), project (shared), local (private), managed (enforced).
2. Managed policy hooks can't be user-disabled (need `disableAllHooks` in managed too).
3. Plugins and skill/agent frontmatter can carry their own hooks.
4. Use `$CLAUDE_PROJECT_DIR`/absolute paths for scripts.
5. Editing settings usually hot-reloads; restart if not.
6. Keep secrets out of committed settings.

## Connects To
- **Ch 2**: each recipe notes which settings file it belongs in.
- **Ch 4**: `if` uses permission-rule syntax from the permission system.
- **Ch 7**: troubleshooting reload, paths, and JSON validity.
