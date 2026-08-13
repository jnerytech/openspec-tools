# Chapter 5: Control Tools & Spawning

## Core Idea
Subagents inherit the main conversation's internal + MCP tools by default. Restrict with `tools` (allowlist) or `disallowedTools` (denylist). A separate `Agent(agent_type)` syntax controls which subagent *types* a main-thread agent may spawn.

## Frameworks Introduced
- **Allowlist vs denylist**:
  - `tools`: exclusive allowlist — only these are usable.
  - `disallowedTools`: removes from the inherited/specified pool.
  - **Combination rule**: if both set, `disallowedTools` applies *first*, then `tools` resolves against the remainder. A tool in both is removed.
- **MCP server-level patterns**: `mcp__<server>` or `mcp__<server>__*` grants/removes every tool from that server. In `disallowedTools`, `mcp__*` removes every MCP tool from any server.
- **`Agent(agent_type)` spawn allowlist**: in a `--agent` main-thread agent's `tools`, restricts which subagent types it can spawn.

## Key Concepts
- **UI-dependent tools never reach subagents** (even if listed in `tools`): `AskUserQuestion`, `EnterPlanMode`, `ScheduleWakeup`, `WaitForMcpServers`, and `ExitPlanMode` (unless `permissionMode: plan`).
- **Task → Agent rename**: in v2.1.63 the Task tool became Agent. `Task(...)` still works as an alias.
- **No `Agent` in `tools`** → the agent cannot spawn any subagents.
- **`Agent` without parens** → may spawn *any* subagent type.

## Code Examples
Allowlist (read-only researcher — no edits, no MCP):
```yaml
---
name: safe-researcher
description: Research agent with restricted capabilities
tools: Read, Grep, Glob, Bash
---
```
Denylist (everything except file writes):
```yaml
---
name: no-writes
description: Inherits every tool except file writes
disallowedTools: Write, Edit
---
```
Remove one MCP server's tools:
```yaml
---
name: local-only
description: Inherits every tool except those from the github MCP server
disallowedTools: mcp__github
---
```
Spawn allowlist (main-thread coordinator):
```yaml
---
name: coordinator
description: Coordinates work across specialized agents
tools: Agent(worker, researcher), Read, Bash
---
```
- **What it demonstrates**: only `worker` + `researcher` can be spawned; any other type fails and the agent sees only the allowed types.

## Reference Tables
| Goal | Field | Value |
| --- | --- | --- |
| Only specific tools | `tools` | `Read, Grep, Glob, Bash` |
| All but a few | `disallowedTools` | `Write, Edit` |
| Drop one MCP server | `disallowedTools` | `mcp__github` |
| Drop all MCP tools | `disallowedTools` | `mcp__*` |
| Restrict spawnable types | `tools` | `Agent(worker, researcher)` |
| Allow spawning anything | `tools` | `Agent` (no parens) |
| Block all spawning | omit `Agent` from `tools` | — |

## Anti-patterns
- **Expecting `Agent(x, y)` to filter inside a subagent definition**: the type list is ignored for subagents — it only works for a `--agent` main thread. In a subagent, listing `Agent` just permits nested spawning.
- **Listing `AskUserQuestion` etc. in `tools`**: still unavailable; they need the main session UI.
- **Assuming `tools` overrides a deny**: a tool in both `tools` and `disallowedTools` is removed.

## Key Takeaways
1. Default = inherit all tools; constrain with `tools` or `disallowedTools`.
2. Both set → deny first, then allowlist on the remainder.
3. `mcp__<server>` patterns scope whole MCP servers; `mcp__*` denies all MCP.
4. `Agent(types)` spawn allowlist only applies to a `--agent` main thread; ignored in subagent defs.
5. Omit `Agent` to block spawning; bare `Agent` allows any.

## Connects To
- **Ch 6**: scoping MCP servers per subagent.
- **Ch 8 / Disable subagents**: `permissions.deny` blocks specific agents (block-list vs the `Agent()` allowlist).
- **Ch 9 (Nested subagents)**: `Agent` in a subagent's tools enables nesting up to depth 5.
