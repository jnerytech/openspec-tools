# Chapter 8: Hooks for Subagents & Disabling Them

## Core Idea
Hooks add lifecycle control. Two placements: in the subagent's frontmatter (run only while that subagent is active) or in `settings.json` (run in the main session on subagent start/stop). `PreToolUse` hooks enable conditional validation finer than the `tools` field. Separately, `permissions.deny` blocks specific subagents.

## Frameworks Introduced
- **Two hook placements**:
  1. Frontmatter `hooks`: run only while that subagent is active; cleaned up when it finishes.
  2. `settings.json` hooks: respond to subagent lifecycle in the main session.
- **Conditional validation pattern**: a `PreToolUse` hook runs a script before each matched tool call; the script reads JSON from stdin, inspects the command, and exits code 2 to block. Use when you need to allow *some* uses of a tool and block others (finer than `tools`).

## Key Concepts
- **Frontmatter hooks fire**: when spawned as subagent (Agent tool / @-mention) AND when run as main session (`--agent`/`agent` setting). In main-session case they run alongside `settings.json` hooks.
- **`Stop` → `SubagentStop`**: a frontmatter `Stop` hook is auto-converted to `SubagentStop` at runtime when invoked as a subagent.
- **Hook input is JSON via stdin**; extract with `jq`. Exit code 2 blocks and returns stderr to Claude.
- **Plugin subagents ignore `hooks`** (also `mcpServers`, `permissionMode`).
- **Windows**: write hook scripts in PowerShell, add `shell: powershell` to the hook entry.

## Reference Tables
Common frontmatter hook events:
| Event | Matcher | Fires |
| --- | --- | --- |
| `PreToolUse` | Tool name | Before subagent uses a tool |
| `PostToolUse` | Tool name | After subagent uses a tool |
| `Stop` | (none) | When subagent finishes (→ `SubagentStop`) |

`settings.json` subagent-lifecycle events:
| Event | Matcher | Fires |
| --- | --- | --- |
| `SubagentStart` | Agent type name | Subagent begins |
| `SubagentStop` | Agent type name | Subagent completes |

## Code Examples
Frontmatter hooks — validate Bash, lint after edits:
```yaml
---
name: code-reviewer
description: Review code changes with automatic linting
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh $TOOL_INPUT"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
---
```
Read-only DB validation script (exit 2 blocks writes):
```shellscript
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
if echo "$COMMAND" | grep -iE '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b' > /dev/null; then
  echo "Blocked: Only SELECT queries are allowed" >&2
  exit 2
fi
exit 0
```
`settings.json` lifecycle hooks:
```json
{
  "hooks": {
    "SubagentStart": [
      { "matcher": "db-agent", "hooks": [ { "type": "command", "command": "./scripts/setup-db-connection.sh" } ] }
    ],
    "SubagentStop": [
      { "hooks": [ { "type": "command", "command": "./scripts/cleanup-db-connection.sh" } ] }
    ]
  }
}
```
Disable specific subagents (`settings.json`):
```json
{ "permissions": { "deny": ["Agent(Explore)", "Agent(my-custom-agent)"] } }
```
Or CLI: `claude --disallowedTools "Agent(Explore)"`

## Worked Example
Give a `db-reader` Bash access but enforce read-only:
1. Frontmatter: `tools: Bash` + a `PreToolUse` matcher `"Bash"` calling `./scripts/validate-readonly-query.sh`.
2. Script reads `tool_input.command` from stdin JSON, greps for write keywords (INSERT/UPDATE/DELETE/DROP/...), exits 2 to block with a stderr message — else exit 0.
3. `chmod +x` the script. Now every Bash call is gated: SELECTs pass, writes are blocked and the reason is fed back to Claude.

## Anti-patterns
- **Putting `hooks`/`mcpServers`/`permissionMode` in a plugin subagent**: silently ignored. Copy the file into `.claude/agents/` to use them.
- **Forgetting `chmod +x`**: the hook command won't run.
- **Using `Agent(...)` allowlist to block one agent**: that's an allowlist; to block specific agents while allowing the rest, use `permissions.deny`.

## Key Takeaways
1. Frontmatter hooks are scoped + auto-cleaned; `settings.json` hooks watch lifecycle in main.
2. `PreToolUse` + exit code 2 = conditional block, finer than `tools`.
3. `Stop` in frontmatter becomes `SubagentStop` at runtime.
4. Plugin subagents ignore hooks/mcpServers/permissionMode.
5. `permissions.deny: ["Agent(name)"]` blocks built-in or custom agents (denylist vs the `Agent()` allowlist).

## Connects To
- **Ch 5**: `Agent(types)` allowlist contrasted with `permissions.deny` denylist.
- **Ch 6**: hooks give finer control than `permissionMode`.
- **Ch 3**: `name` reaches hooks as `agent_type`.
