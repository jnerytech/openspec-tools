# Chapter 3: Input, Output, Exit Codes & Decision Control

## Core Idea
Hooks talk to Claude Code through **stdin (JSON event data) → stdout/stderr + exit code**. Exit codes give coarse control (block/silent); JSON on stdout gives fine-grained, event-specific decisions.

## Frameworks Introduced
- **Exit-code protocol**: 0 = no objection (proceed), 2 = block (stderr → Claude), any other = error (proceeds, logged).
  - When to use: simple block/allow with no extra fields.
  - How: write reason to stderr, `exit 2`.
- **Structured JSON protocol**: `exit 0` + a JSON object on stdout for richer control.
  - When to use: deny with reason, escalate to user, rewrite input, set permission mode.
  - How: print one JSON object; **don't mix with exit 2** (JSON ignored when you exit 2).
- **Most-restrictive-wins merge**: when multiple hooks answer one event, `PreToolUse` permission outcome resolves in order `deny > defer > ask > allow`; all `additionalContext` texts are kept and passed together.

## Key Concepts
- **Common input fields**: every event sends `session_id`, `cwd`, `hook_event_name` on stdin; each event adds its own (`tool_name`+`tool_input` for tool events, `prompt` for `UserPromptSubmit`, `source` for `SessionStart`).
- **stderr**: on exit 2, becomes Claude's feedback; otherwise goes to debug log + transcript notice.
- **`additionalContext`**: `UserPromptSubmit` field that injects text into context (system reminder, read as plain text).
- **`stop_hook_active`**: input flag on `Stop` hooks telling you a continuation is already in progress (ch07 block cap).
- **`updatedInput`**: `PreToolUse` output rewriting a tool's arguments (last writer wins — avoid multiple).

## Decision patterns by event (varies!)
- **`PreToolUse`** → `hookSpecificOutput.permissionDecision`: `allow` | `deny` | `ask` (+ `defer` in `-p` mode).
- **`PostToolUse`, `Stop`** → top-level `decision: "block"`.
- **`PermissionRequest`** → `hookSpecificOutput.decision.behavior`: `allow` (ch02 recipe 7).
- **`UserPromptSubmit`** → `additionalContext` to inject text.

## Mental Models
- Think of exit code as the **verb** (proceed / block / error) and JSON as the **detailed instruction** (why, how, what mode).
- `allow` ≠ override: it only skips the *interactive prompt*. Deny/ask rules (incl. managed settings) still apply. Hooks **tighten, never loosen** (ch07 permission modes).
- Don't depend on a sibling hook's `deny` to cancel another hook's side effects — siblings run to completion regardless.

## Code Examples
Exit-code block (PreToolUse blocking a dangerous Bash command):
```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')
if echo "$COMMAND" | grep -q "drop table"; then
  echo "Blocked: dropping tables is not allowed" >&2  # stderr → Claude's feedback
  exit 2                                               # exit 2 = block
fi
exit 0  # exit 0 = no decision; normal permission flow applies
```
- **What it demonstrates**: read stdin, decide, block with reason via exit 2.

Structured JSON deny (PreToolUse, exit 0):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Use rg instead of grep for better performance"
  }
}
```
- **What it demonstrates**: deny + reason fed back to Claude without exit 2.

## Reference Tables
| Mechanism | How | Best for |
| --- | --- | --- |
| `exit 0` | silent | no objection; stdout→context on SessionStart/UserPromptSubmit |
| `exit 2` | stderr = reason | hard block, simple |
| `exit other` | stderr→debug log | unexpected error (action still proceeds) |
| JSON on stdout (exit 0) | one object | deny w/ reason, ask, allow, set mode, rewrite input |

`PreToolUse` permissionDecision values:
| Value | Effect |
| --- | --- |
| `allow` | skip interactive prompt (deny/ask rules still apply) |
| `deny` | cancel call, send reason to Claude |
| `ask` | show prompt as normal |
| `defer` | `-p` mode only; preserve call for SDK to resume |

## Worked Example
Two `PreToolUse` hooks on `Bash` — logging + guardrail — showing the merge:
```json
{ "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [
  { "type": "command", "command": "jq -r .tool_input.command >> ~/.claude/bash.log" },
  { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-rm-rf.sh" }
] } ] } }
```
When Claude runs `rm -rf /tmp/build`: both fire in parallel. The logger writes the line and exits 0 (no decision). The guardrail exits 2 (deny). **Deny wins**, command is blocked, Claude sees the guardrail's stderr — but the log line is still written because the logger already ran. Lesson: deny does not roll back a sibling's side effect.

## Key Takeaways
1. stdin = JSON event data; act on `tool_input`, `prompt`, `source`, etc.
2. exit 0 = proceed, exit 2 = block (+stderr reason), else = error.
3. For rich control, `exit 0` and print one JSON object — never mix with exit 2.
4. Decision field name differs by event (permissionDecision / decision / behavior / additionalContext).
5. Multiple hooks merge most-restrictive-first; all `additionalContext` kept.
6. `allow` skips the prompt but never overrides deny rules.

## Connects To
- **Ch 2**: recipes that use these protocols (block, auto-approve).
- **Ch 5**: prompt/agent hooks use a different `ok`/`reason` format.
- **Ch 7**: `stop_hook_active`, JSON-validation pitfalls, permission-mode interaction.
