# Chapter 11: Nested Subagents & Context Management

## Core Idea
A subagent can spawn its own subagents (depth limit 5). Each non-fork subagent starts with a fresh, isolated context — it does not see your history, invoked skills, or files Claude already read. Understanding exactly what loads (and how to resume) lets you control cost and continuity.

## Frameworks Introduced
- **Nested-subagent depth rule** (v2.1.172+): a subagent can spawn subagents; depth = levels below main, regardless of foreground/background. A subagent at **depth 5 does not get the Agent tool** and cannot spawn further. Limit is fixed, not configurable. A fork cannot spawn another fork but can spawn other types (which count toward depth).
- **"What loads at startup" inventory**: the precise list of what a fresh (non-fork) subagent's context contains.
- **Resume model**: each invocation is a new instance; ask Claude to resume to continue with full prior history.

## Key Concepts
- **Fresh context**: no conversation history, no prior skills, no previously-read files. Claude composes a delegation message summarizing the task. (Exception: a fork inherits the parent — see Ch 12.)
- **`SendMessage` resumes** by agent ID or name; always available. Stopped subagent receiving a `SendMessage` auto-resumes in the background.
- **Explore/Plan are one-shot**: return no agent ID, can't be resumed. Use general-purpose or a custom subagent when you need to continue.
- **Transcripts**: `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`. Persist independently of main; unaffected by main compaction; cleaned per `cleanupPeriodDays` (default 30).

## Reference Tables
A non-fork subagent's initial context contains:
| Component | Detail | Explore/Plan? |
| --- | --- | --- |
| System prompt | Agent's own prompt + env details (NOT full CC prompt) | own predefined |
| Task message | Delegation prompt Claude writes | yes |
| CLAUDE.md + memory | Full memory hierarchy (`~/.claude/CLAUDE.md`, project rules, `CLAUDE.local.md`, managed policy) | **skipped** |
| Git status | Snapshot from parent session start (absent if not a repo or `includeGitInstructions:false`) | **skipped** |
| Preloaded skills | Full content of `skills` field | not preloaded |

## Worked Example
You delegated a review and now want the authorization logic checked too, without restarting:
```text
Use the code-reviewer subagent to review the authentication module
[Agent completes — Claude receives its agent ID]

Continue that code review and now analyze the authorization logic
[Claude resumes the subagent via SendMessage with full prior context]
```
The resumed instance retains all previous tool calls, results, and reasoning — it picks up exactly where it stopped. Had you used Explore (one-shot, no ID), this resume would be impossible; you'd start fresh.

## Auto-compaction
- Subagents auto-compact using the same logic/conditions as main; `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` applies.
- Logged in the transcript as a `compact_boundary` system event with `compactMetadata.preTokens` (tokens used before compaction):
```json
{ "type": "system", "subtype": "compact_boundary",
  "compactMetadata": { "trigger": "auto", "preTokens": 167189 } }
```

## Anti-patterns
- **Expecting a subagent to know what main already read**: it doesn't — restate critical rules (e.g. "ignore `vendor/`") in the delegation prompt.
- **Trying to resume Explore/Plan**: impossible; they return no agent ID. Use general-purpose/custom.
- **Relying on a rule reaching Explore via CLAUDE.md**: Explore/Plan skip CLAUDE.md — main reads their results with full CLAUDE.md context, so most rules don't need to reach the subagent; if one must, put it in the prompt.

## Key Takeaways
1. Nesting allowed to depth 5; depth-5 agents can't spawn further.
2. Non-fork subagents start fresh — no history, skills, or read files.
3. Explore/Plan skip CLAUDE.md + git; every other agent loads them.
4. Resume via `SendMessage` (ID/name) to keep full prior context; Explore/Plan can't resume.
5. Transcripts persist separately, survive main compaction, cleaned after `cleanupPeriodDays`.

## Connects To
- **Ch 1**: Explore/Plan's context-light behavior.
- **Ch 5**: `Agent` in tools enables nesting.
- **Ch 12**: forks inherit context instead of starting fresh.
