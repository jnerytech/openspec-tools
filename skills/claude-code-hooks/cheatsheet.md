# Cheatsheet — Claude Code Hooks

## Pick the hook type
- Need a **deterministic rule** → `command` (or `http` to offload). 
- Decision needs **judgment, input is enough** → `prompt` (Haiku, 30 s).
- Decision needs to **inspect the codebase** → `agent` (60 s, ≤50 turns, experimental).
- Want to **block before harm** → `PreToolUse`. **Observe after** → `PostToolUse` (can't undo).
- Want **stdout → context** → `SessionStart` / `UserPromptSubmit`.

## Block vs allow — decide the output
- Hard block, no detail → **exit 2 + stderr reason**.
- Block/allow/ask with detail → **exit 0 + JSON** (never mix with exit 2).
- Multiple hooks on one event → most-restrictive wins: **deny > defer > ask > allow**.
- Remember: `allow` skips the *prompt* only; **deny rules always win**. Hooks tighten, never loosen.

## Exit code → effect
| Code | Effect |
| --- | --- |
| 0 | proceed (stdout→context on SessionStart/UserPromptSubmit) |
| 2 | block; stderr = Claude's feedback |
| other | error; action proceeds; stderr→debug log |

## Decision field by event (don't guess)
| Event | Field |
| --- | --- |
| `PreToolUse` | `hookSpecificOutput.permissionDecision` (allow/deny/ask/defer) |
| `PostToolUse`, `Stop` | top-level `decision:"block"` |
| `PermissionRequest` | `hookSpecificOutput.decision.behavior` |
| `UserPromptSubmit` | `additionalContext` (inject text) |
| `prompt`/`agent` (any) | `{"ok":bool,"reason":str}` |

## Timeouts
command/http/mcp = 10 min · prompt = 30 s · agent = 60 s · `UserPromptSubmit` caps to 30 s · `MessageDisplay` to 10 s · override per-hook with `timeout` (seconds).

## Matcher tells
- Empty/missing matcher → fires on **all** occurrences.
- Tool events: name, supports `Edit|Write`, `mcp__.*` (case-sensitive).
- `FileChanged`: **literal** filenames split on `|` (NOT regex).
- No-matcher events: `UserPromptSubmit`, `Stop`, `PostToolBatch`, `CwdChanged`, `MessageDisplay`, `TaskCreated/Completed`, `WorktreeCreate/Remove`, `TeammateIdle`.
- `if` ⊃ matcher: filters name **and args** (`Bash(git *)`), v2.1.85+, tool events only, **fails open** (not security).

## Scope → location
| Need | File |
| --- | --- |
| all my projects | `~/.claude/settings.json` |
| share with team | `.claude/settings.json` (commit) |
| private to project | `.claude/settings.local.json` (gitignored) |
| enforce, unbypassable | managed policy settings (+`disableAllHooks` there) |
| bundle w/ plugin/skill | plugin `hooks/hooks.json` / component frontmatter |

## Smells & fast fixes
- Hook not in `/hooks` → invalid JSON (no trailing commas/comments) or wrong file → fix, restart.
- "command not found" → use `${CLAUDE_PROJECT_DIR}`/absolute path, `chmod +x`, or `"args": []` exec form.
- "JSON validation failed" but output looks fine → shell profile echo leaked → guard with `if [[ $- == *i* ]]`.
- Stop hook loops → check `stop_hook_active`, exit 0; raise `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (default cap 8).
- `PermissionRequest` never fires → you're in `-p` mode → use `PreToolUse`.

## Defaults & thresholds to remember
- prompt-hook model = **Haiku** (override with `model`).
- agent hook = **60 s / 50 turns**, experimental.
- Stop block cap = **8** consecutive.
- Debug: `claude --debug-file /tmp/claude.log` + `tail -f`, or `/debug`; transcript `Ctrl+O`.
