# Chapter 1: Built-in Subagents

## Core Idea
Claude Code ships with automatically-invoked subagents (Explore, Plan, general-purpose, plus helpers). Each runs in its own context window and inherits the parent's permissions with extra tool restrictions — so verbose work stays out of your main conversation.

## Frameworks Introduced
- **The three primary built-ins**: Explore (search), Plan (planning research), general-purpose (do-everything).
  - When to use: let Claude auto-delegate; pick the matching purpose below.
  - How: Claude reads each agent's `description`/purpose and the task to decide.
- **"Skip CLAUDE.md for speed" rule**: Explore and Plan are the *only* subagents that skip your CLAUDE.md files and the parent git status, to stay fast and cheap. Every other built-in or custom subagent loads both.

## Key Concepts
- **Explore**: read-only, Haiku model, denied Write/Edit. File discovery, code search, codebase exploration. Takes a thoroughness level: **quick**, **medium**, or **very thorough**.
- **Plan**: read-only, inherits main model, denied Write/Edit. Used during plan mode to gather context before presenting a plan.
- **general-purpose**: all tools, inherits main model. For complex multi-step tasks needing both exploration and modification.
- **statusline-setup**: Sonnet, runs when you use `/statusline`.
- **claude-code-guide**: Haiku, runs when you ask about Claude Code features.
- **Always registered**: built-ins are always present in interactive sessions.

## Mental Models
- Use **Explore** when you need to *find/understand* without changing anything — context savings come from keeping search results out of main.
- Use **general-purpose** when the task needs exploration *and* edits *and* multiple dependent steps.
- Think of Explore/Plan as "fast scouts" that deliberately run context-light; everything else is "fully briefed."

## Reference Tables
| Agent | Model | Tools | Loads CLAUDE.md + git? | Purpose |
| --- | --- | --- | --- | --- |
| Explore | Haiku | Read-only (no Write/Edit) | No | Search, codebase exploration |
| Plan | Inherits | Read-only (no Write/Edit) | No | Research for planning |
| general-purpose | Inherits | All | Yes | Complex multi-step + edits |
| statusline-setup | Sonnet | — | Yes | `/statusline` config |
| claude-code-guide | Haiku | — | Yes | Claude Code feature questions |

## Disabling built-ins
- Block one type: add `Agent(<name>)` to `permissions.deny`.
- Block *all* delegation: deny the `Agent` tool itself in `permissions.deny`.
- Headless / Agent SDK: set `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` to remove all built-ins and supply only your own.

## Key Takeaways
1. Explore + Plan are read-only, context-light, and skip CLAUDE.md/git — by design, not configurable.
2. general-purpose is the only built-in with full tool access.
3. Claude picks built-ins automatically from task + description.
4. To stop delegation entirely, deny the `Agent` tool.

## Connects To
- **Ch 11**: "What loads at startup" details exactly what reaches each subagent.
- **Ch 9**: how delegation decisions are made.
- **Ch 5**: `Agent(agent_type)` allowlist/denylist syntax.
