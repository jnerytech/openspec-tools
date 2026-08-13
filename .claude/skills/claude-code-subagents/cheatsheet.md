# Cheatsheet — Claude Code Subagents

## Subagent vs Main vs Fork vs Skill — decide fast
- **Verbose, self-contained output you won't reuse** → subagent.
- **Need tool/permission restriction enforced** → subagent.
- **Iterative back-and-forth, shared context, quick edit, latency-sensitive** → main conversation.
- **Side task that needs all current context** → fork (`/fork ...`).
- **Reusable prompt/workflow in MAIN context** → Skill, not subagent.
- **Quick question about current conversation** → `/btw` (no tools, discarded).
- **Sustained parallelism past your context window** → agent teams.

## Tool restriction — which field?
- Want *only* these tools → `tools:` (allowlist; drops MCP unless listed).
- Want *all but* a few → `disallowedTools:` (denylist; keeps MCP).
- Both set → **deny applied first**, then allowlist on the remainder; tool in both = removed.
- Drop a whole MCP server → `disallowedTools: mcp__<server>`. Drop all MCP → `mcp__*`.
- Never reach subagents regardless of `tools`: `AskUserQuestion`, `EnterPlanMode`, `ScheduleWakeup`, `WaitForMcpServers`, `ExitPlanMode` (unless `permissionMode: plan`).

## Spawning control
| Goal | Setting |
| --- | --- |
| Restrict spawnable types (`--agent` main only) | `tools: Agent(worker, researcher)` |
| Allow any spawn | `tools: Agent` (no parens) |
| Block all spawning | omit `Agent` from `tools` |
| Block a specific agent (allow rest) | `permissions.deny: ["Agent(name)"]` |
| Depth limit | 5 (depth-5 agent gets no Agent tool) |

## Model resolution (first set wins)
1. `CLAUDE_CODE_SUBAGENT_MODEL` env var
2. Per-invocation `model` param
3. Frontmatter `model`
4. Main conversation's model (= `inherit`, the default)
→ Route cheap/high-volume to `haiku`; analysis to `sonnet`/`opus`.

## Scope priority (higher wins on same `name`)
managed (1) > `--agents` flag (2) > project `.claude/agents/` (3) > user `~/.claude/agents/` (4) > plugin (5).
- Duplicate `name` in one scope → one silently dropped. Keep names unique tree-wide.
- Project = commit to VCS; user = personal; `--agents` JSON = session-only.

## Permission-mode precedence
- Parent `bypassPermissions` or `acceptEdits` → **forced**, child can't override.
- Parent `auto` → child inherits auto, child `permissionMode` **ignored**.
- Else child may override. Use `bypassPermissions` sparingly (writes to `.git`/`.claude`/etc).

## Memory scope — pick one
- `project` → **default**; shareable via VCS (`.claude/agent-memory/<name>/`).
- `user` → cross-project (`~/.claude/agent-memory/<name>/`).
- `local` → project-specific, not committed (`.claude/agent-memory-local/<name>/`).
- Only first **200 lines / 25KB** of `MEMORY.md` loads → curate.

## What a fresh (non-fork) subagent gets
Own system prompt + env • delegation task message • CLAUDE.md + memory hierarchy • git snapshot • preloaded `skills`.
- **Explore & Plan skip CLAUDE.md + git** (only ones that do). Not configurable.
- It does NOT see: your history, invoked skills, files Claude already read → restate critical rules in the prompt.

## Resume / continuity
- Resumable: general-purpose, custom subagents. **Not** resumable: Explore, Plan (one-shot, no agent ID).
- Resume via `SendMessage` (ID or name); stopped agent auto-resumes in background.
- Transcripts: `~/.claude/projects/{project}/{sessionId}/subagents/agent-{id}.jsonl`; survive main compaction; cleaned per `cleanupPeriodDays` (30d default).

## Fork tells
- Use when re-explaining context is costly, or to try parallel approaches from one start.
- Inherits everything; shares prompt cache → cheaper than fresh subagent. Can't nest forks.
- `/fork <directive>` (v2.1.117+; env `CLAUDE_CODE_FORK_SUBAGENT=1` before v2.1.161). Fork mode → all spawns background.

## Hooks quick map
- Per-subagent (frontmatter): `PreToolUse`/`PostToolUse`/`Stop`(→`SubagentStop`). Conditional block = exit code 2.
- Main-session (settings.json): `SubagentStart`/`SubagentStop`, matched by agent type name.
- Plugin subagents ignore `hooks`, `mcpServers`, `permissionMode`.

## Gotchas
- Disk edits need session restart; `/agents` edits are live.
- `cd` inside a subagent doesn't persist between Bash calls → use `isolation: worktree` for an isolated repo copy.
- `Agent(types)` allowlist is ignored inside subagent defs (only `--agent` main threads).
- `skills` preloads content; it is NOT access control.
