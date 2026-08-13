# Chapter 4: Matchers & the `if` Field

## Core Idea
Without a matcher a hook fires on **every** occurrence of its event. `matcher` filters at the group level (by one field, usually tool name); the `if` field filters per-handler by tool name **and arguments** together.

## Frameworks Introduced
- **`matcher` (group-level filter)**: a string matched against the event's one filterable field; supports plain names and `|` alternation / regex for tool events.
  - When to use: narrow an event to specific tools/sources/reasons.
  - How: set `"matcher": "Edit|Write"` (or `"Bash"`, `"mcp__.*"`, `"compact"`, etc.).
- **`if` (handler-level filter)**: uses **permission rule syntax** to spawn the hook process only when the tool call matches name + args.
  - When to use: "run only on `git` commands," not all Bash; avoid spawning a process per call.
  - How: `"if": "Bash(git *)"` on a handler. Requires Claude Code **v2.1.85+** (older versions ignore it).

## Key Concepts
- **Matcher field varies by event**: tool name (tool events), session source (`SessionStart`), end reason (`SessionEnd`), notification type, agent type, compaction trigger, config source, etc.
- **No-matcher events**: `UserPromptSubmit`, `PostToolBatch`, `Stop`, `TeammateIdle`, `TaskCreated/Completed`, `WorktreeCreate/Remove`, `CwdChanged`, `MessageDisplay` — always fire.
- **`FileChanged` matcher**: literal filenames split on `|` (NOT regex), e.g. `.envrc|.env`.
- **MCP tool naming**: `mcp__<server>__<tool>` — match a server with `mcp__github__.*`, across servers with `mcp__.*__write.*`.
- **Case-sensitive**: matchers must match the tool name exactly.

## Mental Models
- `matcher` = coarse gate at the group ("which tool?"); `if` = fine gate at the handler ("which tool *with these args*?").
- Think of `if` as **best-effort, fails open**: unparseable Bash → hook runs anyway. For hard enforcement, use the permission system, not `if`.
- Bash commands are decomposed: subcommands, `$()`, and backticks are each checked against `if`.

## Anti-patterns
- **Trusting `if`/`matcher` for security**: best-effort and fails open. Use [permission rules](https://code.claude.com/docs/en/permissions) for hard allow/deny.
- **Regex in `FileChanged` matcher**: it's literal filenames, not regex — `.*` won't work.
- **`if` on non-tool events**: only works on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`. Adding it elsewhere **prevents the hook from running**.

## Code Examples
`matcher` limiting a formatter to edits:
```json
{ "hooks": { "PostToolUse": [ { "matcher": "Edit|Write",
  "hooks": [ { "type": "command", "command": "prettier --write ..." } ] } ] } }
```
`if` limiting a hook to git commands only:
```json
{ "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [
  { "type": "command", "if": "Bash(git *)",
    "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check-git-policy.sh" } ] } ] } }
```
- **What it demonstrates**: group matches all Bash; `if` spawns the process only for `git *`.

## Reference Tables
Matcher field by event (selected):
| Event(s) | Matcher filters | Example values |
| --- | --- | --- |
| `PreToolUse`/`PostToolUse`/`PostToolUseFailure`/`PermissionRequest`/`PermissionDenied` | tool name | `Bash`, `Edit\|Write`, `mcp__.*` |
| `SessionStart` | how started | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | why ended | `clear`, `resume`, `logout`, `prompt_input_exit`, `other` |
| `Notification` | type | `permission_prompt`, `idle_prompt`, `auth_success` |
| `SubagentStart`/`SubagentStop` | agent type | `general-purpose`, `Explore`, `Plan`, custom |
| `PreCompact`/`PostCompact` | trigger | `manual`, `auto` |
| `ConfigChange` | source | `user_settings`, `project_settings`, `skills`, … |
| `FileChanged` | literal filenames | `.envrc\|.env` |
| `UserPromptExpansion` | command name | your skill/command names |

`if` pattern behavior:
| `if` pattern | Bash command | Runs? | Why |
| --- | --- | --- | --- |
| `Bash(git *)` | `git push` | yes | command name matches |
| `Bash(git *)` | `npm test && git push` | yes | each subcommand checked |
| `Bash(git *)` | `echo $(git log)` | yes | `$()`/backticks checked |
| `Bash(git *)` | `echo $(date)` | no | no subcommand matches |
| `Bash(git push *)` | `echo $(date)` | yes | over-specified patterns run on `$()`/backticks/`$VAR` |

## Worked Example
Goal: log every Bash command but enforce git policy only on git.
- Group `PreToolUse` / `matcher: "Bash"` with two handlers.
- Handler A (no `if`): `jq -r .tool_input.command >> ~/.claude/bash.log` — logs all.
- Handler B (`if: "Bash(git *)"`): runs `check-git-policy.sh` — process spawns only for git, so `npm test` never pays the cost. `git commit` triggers both; `npm install` triggers only A.

## Key Takeaways
1. No matcher = fires on every event occurrence.
2. `matcher` = group-level, one field, supports `|`/regex (case-sensitive); `FileChanged` is literal filenames.
3. `if` = handler-level, name+args via permission-rule syntax; v2.1.85+.
4. `if` is best-effort and fails open — not a security boundary.
5. `if` only on tool events; elsewhere it disables the hook.
6. MCP tools: `mcp__<server>__<tool>`; match with regex.

## Connects To
- **Ch 1**: where matcher sits in the config shape.
- **Ch 3**: matched hooks merge most-restrictive-first.
- **Ch 6**: permission rules referenced by `if`.
