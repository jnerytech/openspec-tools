# Patterns — Claude Code Subagents

## Minimal Subagent File
**When to use**: starting any custom subagent.
**How**: only `name` + `description` required; body = system prompt. Add fields to constrain.
```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---
You are a code reviewer. Provide specific, actionable feedback.
```
**Trade-offs**: more fields = more control, less inheritance from main.

## Read-Only Restricted Agent
**When to use**: research/review that must not modify files.
**How**: `tools: Read, Grep, Glob, Bash` (allowlist) — no Edit/Write/MCP. Or `disallowedTools: Write, Edit` to keep everything else.
**Trade-offs**: allowlist is stricter (drops MCP); denylist keeps inherited tools.

## Drop a Specific MCP Server
**When to use**: keep one server's tools out of a subagent.
**How**: `disallowedTools: mcp__github` (or `mcp__*` to drop all MCP).
**Trade-offs**: server-level only; can't deny single tools by this pattern.

## Hide a Heavy MCP Server From Main
**When to use**: an MCP server only one subagent needs, whose tool descriptions bloat main context.
**How**: define it inline under `mcpServers` in that subagent (not in `.mcp.json`).
**Trade-offs**: connects on subagent start, disconnects on finish; main never pays the context cost.

## Conditional Tool Validation (PreToolUse hook)
**When to use**: allow some uses of a tool, block others (finer than `tools`). Classic: read-only SQL.
**How**: `PreToolUse` matcher → script reads stdin JSON, greps the command, `exit 2` to block.
```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks: [ { type: command, command: "./scripts/validate-readonly-query.sh" } ]
```
**Trade-offs**: needs an executable script (`chmod +x`); Windows uses PowerShell + `shell: powershell`. Ignored for plugin subagents.

## Restrict Spawnable Types (coordinator)
**When to use**: a `--agent` main thread should spawn only certain workers.
**How**: `tools: Agent(worker, researcher), Read, Bash` (allowlist). Bare `Agent` = any; omit `Agent` = none.
**Trade-offs**: only works for `--agent` main thread; ignored in subagent defs. To block specific agents while allowing others, use `permissions.deny: ["Agent(name)"]`.

## Preload Domain Skills
**When to use**: subagent needs conventions/knowledge without runtime discovery.
**How**: `skills: [api-conventions, error-handling-patterns]` — full content injected at startup.
**Trade-offs**: preload ≠ access; without it the agent can still invoke skills via the Skill tool. Can't preload `disable-model-invocation: true` skills.

## Persistent-Memory Learning Agent
**When to use**: a subagent that should accumulate knowledge across sessions.
**How**: `memory: project` + body instruction to update memory; ask it to consult memory before and save after.
**Trade-offs**: `project` shares via VCS; `user` = cross-project; `local` = not committed. Only first 200 lines/25KB of `MEMORY.md` load — curate it.

## Isolate High-Volume Output
**When to use**: tests, doc fetches, log processing that would flood main.
**How**: *"Use a subagent to run the test suite and report only the failing tests with their error messages."*
**Trade-offs**: verbose output stays in subagent; only the summary returns.

## Parallel Independent Research
**When to use**: independent investigations with no cross-dependency.
**How**: *"Research the auth, database, and API modules in parallel using separate subagents."* Claude synthesizes.
**Trade-offs**: many detail-returning subagents can still bloat main; for sustained parallelism use agent teams.

## Chain Subagents
**When to use**: multi-step workflow where each step feeds the next.
**How**: *"Use code-reviewer to find performance issues, then optimizer to fix them."*
**Trade-offs**: Claude passes relevant context between steps; each starts fresh otherwise.

## Resume a Subagent
**When to use**: continue prior work with full history instead of restarting.
**How**: ask Claude to continue; it uses `SendMessage` (agent ID/name). Stopped agent auto-resumes in background.
**Trade-offs**: Explore/Plan are one-shot (no ID) — use general-purpose/custom to enable resume.

## Fork for Same-Context Side Task
**When to use**: a side task that would need too much background to re-explain, or parallel approaches from one start.
**How**: `/fork draft unit tests for the parser changes so far`.
**Trade-offs**: fork inherits everything (no input isolation) but shares prompt cache (cheaper); can't nest forks. Add `isolation: "worktree"` to isolate edits.

## Session-Wide Specialized Agent
**When to use**: a whole project/session should behave as one specialist.
**How**: `claude --agent code-reviewer`, or `{ "agent": "code-reviewer" }` in `.claude/settings.json` (flag overrides setting).
**Trade-offs**: replaces the default system prompt entirely; CLAUDE.md still loads.
