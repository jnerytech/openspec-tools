# Chapter 1: Hook Fundamentals & Lifecycle

## Core Idea
Hooks are user-defined shell commands (or HTTP/LLM calls) that fire at fixed points in Claude Code's lifecycle, giving **deterministic** control over behavior — actions that always happen, instead of relying on the model to choose to run them.

## Frameworks Introduced
- **Deterministic vs. judgment control**: use `command`/`http` hooks for deterministic rules; use `prompt`/`agent` hooks (ch05) when the decision needs judgment.
  - When to use: enforce project rules, automate repetitive tasks, integrate external tools.
  - How: add a `hooks` block to a settings file (ch06), keyed by event name.
- **Event → matcher → hooks shape**: every config is `{ "hooks": { "<Event>": [ { "matcher": "...", "hooks": [ {type, command} ] } ] } }`.
  - When to use: every hook definition.
  - How: outer key = event; each group has a `matcher` (optional) and an inner `hooks` array of handlers.
- **Parallel fire + dedup**: when an event fires, all matching hooks run in parallel; identical commands are auto-deduplicated.

## Key Concepts
- **Event**: a named lifecycle point (e.g. `PreToolUse`, `Stop`) that triggers hooks.
- **Matcher**: filter narrowing which occurrences of an event run the hook (ch04).
- **Handler**: one `{type, command, ...}` object inside a group's inner `hooks` array.
- **`/hooks` menu**: read-only browser of configured hooks, grouped by event. Edit settings JSON to change them.
- **Hook type**: `command` (default), `http`, `mcp_tool`, `prompt`, `agent` (ch05).

## Mental Models
- Think of a hook as a **lifecycle interrupt**: Claude Code pauses at the event, runs your code, reads the result, then continues per your decision.
- Use hooks when "the LLM *should* do X but I need X to *always* happen."
- `/hooks` is the source of truth for "is my hook registered?" — but it cannot edit.

## Key Events (full table in cheatsheet.md)
- **`SessionStart`** — session begins/resumes. stdout → context.
- **`UserPromptSubmit`** — prompt submitted, before processing. stdout → context. Can't block via matcher.
- **`PreToolUse`** — before a tool runs. **Can block.**
- **`PostToolUse`** — after a tool succeeds. **Cannot undo** (tool already ran).
- **`PostToolUseFailure`** — after a tool fails.
- **`Notification`** — Claude sends a notification (waiting for input/permission).
- **`Stop`** — Claude finishes responding (fires every turn, not only at task end).
- **`PermissionRequest`** — a permission dialog is about to show (ch03 decision control).
- **`ConfigChange` / `CwdChanged` / `FileChanged`** — reactive: config edited, dir changed, watched file changed.
- **`SessionEnd`** — session terminates.
- **`PreCompact` / `PostCompact`** — around context compaction.
- **`SubagentStart` / `SubagentStop`**, **`SetUp`**, **`InstructionsLoaded`**, **`WorktreeCreate/Remove`**, **`Elicitation*`**, **`StopFailure`**, **`PostToolBatch`**, **`TaskCreated/Completed`**, **`TeammateIdle`**, **`MessageDisplay`**, **`UserPromptExpansion`** — see cheatsheet.

## Anti-patterns
- **Relying on `PostToolUse` to prevent harm**: it runs after execution — too late. Use `PreToolUse` to block.
- **Assuming hooks run sequentially**: they run in parallel; never let one hook's `deny` suppress another's side effects (ch03).
- **Editing the `/hooks` menu**: it's read-only; edit settings JSON instead.

## Code Examples
Minimal Notification hook (desktop alert when Claude needs input), in `~/.claude/settings.json`:
```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Claude Code needs your attention'"
          }
        ]
      }
    ]
  }
}
```
- **What it demonstrates**: the canonical event→matcher→handler shape; empty matcher = fires on all notification types.

## Reference Tables
| Hook type | Runs | Default timeout |
| --- | --- | --- |
| `command` | shell command | 10 min |
| `http` | POST to URL | 10 min |
| `mcp_tool` | call connected MCP tool | 10 min |
| `prompt` | single LLM (Haiku) yes/no | 30 s |
| `agent` | multi-turn subagent w/ tools | 60 s |

(`UserPromptSubmit` caps command/http/mcp at 30 s; `MessageDisplay` at 10 s.)

## Worked Example
Confirming a new hook is live, end-to-end:
1. Add the Notification block above to `~/.claude/settings.json`.
2. The file watcher normally auto-reloads; if not, restart the session.
3. Run `/hooks`, select `Notification` — the handler should appear under it.
4. Trigger it: let Claude reach a point where it waits for input → the desktop notification fires.
5. If nothing registers: validate JSON (no trailing commas/comments), confirm the file path is correct (ch07).

## Key Takeaways
1. Hooks = deterministic lifecycle control; the model can't skip them.
2. Config shape is always Event → group(matcher) → handlers(type, command).
3. Matching hooks fire **in parallel**, identical ones deduped.
4. `PreToolUse` blocks before action; `PostToolUse` only observes after.
5. `/hooks` browses (read-only); settings JSON edits.
6. Pick `command`/`http` for rules, `prompt`/`agent` for judgment.

## Connects To
- **Ch 2**: ready-made recipes per event.
- **Ch 3**: how a hook returns a decision (exit codes / JSON).
- **Ch 4**: matchers and the `if` field.
- **Ch 6**: where to put the settings block (scope).
