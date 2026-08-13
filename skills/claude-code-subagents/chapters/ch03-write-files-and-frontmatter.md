# Chapter 3: Writing Subagent Files & Frontmatter Reference

## Core Idea
A subagent file = YAML frontmatter (config) + Markdown body (the system prompt). Only `name` and `description` are required. The body becomes the subagent's system prompt — it does NOT get the full Claude Code system prompt, only its own prompt plus basic environment details.

## Frameworks Introduced
- **Minimal valid subagent**: `name` + `description` + body. Everything else is optional and inherits.
  - When to use: start minimal, add fields only to constrain or specialize.
  - How: see code example.
- **Load timing rule**: subagents load at session start. Editing a file on disk requires a **restart**. Subagents created via the `/agents` interface take effect **immediately**.

## Code Examples
```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```
- **What it demonstrates**: frontmatter = metadata/config; body = system prompt. The subagent sees only this prompt + environment (e.g. working directory).

## Key Concepts
- **Working directory**: subagent starts in the main conversation's CWD. `cd` inside the subagent does NOT persist between Bash/PowerShell calls and does NOT affect the main session's CWD.
- **isolation: worktree**: gives the subagent an isolated copy of the repo (see Ch 5/Ch 12).
- **name**: lowercase + hyphens, unique. Hooks receive it as `agent_type`. Filename need not match `name`.
- **description**: tells Claude *when* to delegate — this is the delegation trigger.

## Reference Tables
Supported frontmatter fields (only `name`, `description` required):
| Field | Req | Meaning |
| --- | --- | --- |
| `name` | Yes | Unique id, lowercase+hyphens. Hooks see it as `agent_type`. Filename independent |
| `description` | Yes | When Claude should delegate here |
| `tools` | No | Allowlist of tools. Inherits all if omitted. Use `skills` field to preload skills, not `Skill` here |
| `disallowedTools` | No | Denylist; removed from inherited/specified pool |
| `model` | No | `sonnet`/`opus`/`haiku`/`fable`/full id/`inherit`. Default `inherit` |
| `permissionMode` | No | `default`/`acceptEdits`/`auto`/`dontAsk`/`bypassPermissions`/`plan`. Ignored for plugin subagents |
| `maxTurns` | No | Max agentic turns before stop |
| `skills` | No | Skills to preload (full content injected). Can still invoke unlisted skills via Skill tool |
| `mcpServers` | No | MCP servers: string ref or inline def. Ignored for plugin subagents |
| `hooks` | No | Lifecycle hooks scoped to this subagent. Ignored for plugin subagents |
| `memory` | No | Persistent memory scope: `user`/`project`/`local` |
| `background` | No | `true` = always run as background task. Default `false` |
| `effort` | No | `low`/`medium`/`high`/`xhigh`/`max`. Overrides session effort; levels depend on model |
| `isolation` | No | `worktree` = run in temp git worktree (isolated repo copy, branched from default branch). Auto-cleaned if no changes |
| `color` | No | `red`/`blue`/`green`/`yellow`/`purple`/`orange`/`pink`/`cyan` |
| `initialPrompt` | No | Auto-submitted first user turn when run as main agent (`--agent`/`agent` setting). Commands+skills processed; prepended to user prompt |

## Anti-patterns
- **Listing `Skill` in `tools` to preload a skill**: wrong field — use `skills` to inject content. `tools` only controls invocation access.
- **Expecting `cd` to stick**: it resets every Bash call inside a subagent.
- **Editing on disk mid-session and assuming it loaded**: restart, or use `/agents` for immediate effect.

## Key Takeaways
1. `name` + `description` are the only required fields; rest inherits.
2. Body = system prompt; subagent gets no full Claude Code system prompt.
3. Disk edits need a session restart; `/agents` edits are live.
4. `cd` is non-persistent inside subagents — use `isolation: worktree` for an isolated repo copy.
5. `--agents` JSON accepts every field listed here.

## Connects To
- **Ch 4**: `model` resolution order.
- **Ch 5/6/7/8**: deep dives on `tools`, `mcpServers`, `permissionMode`, `skills`, `memory`, `hooks`.
- **Ch 12**: `isolation: worktree` with forks.
