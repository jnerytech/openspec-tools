---
name: claude-code-subagents
description: "Knowledge base from \"Create custom subagents\" (Claude Code documentation). Use when configuring or invoking Claude Code subagents — frontmatter fields, tools/permissions, MCP scoping, models, skills/memory, hooks, delegation, nested subagents, context loading, and forks — or referencing these concepts."
---

<!-- argument-hint: [topic, frontmatter field, or chapter number] -->

# Create Custom Subagents (Claude Code)
**Source**: Claude Code documentation (code.claude.com/docs/en/sub-agents) | **Sections**: 5 | **Chapters**: 12 | **Generated**: 2026-06-23

## How to Use This Skill

- **Without arguments** — load the core frameworks below for reference
- **With a topic** — ask about `frontmatter`, `permission modes`, `fork`, `memory`, `tools`; I find and read the relevant chapter
- **With chapter** — ask for `ch06`; I load that specific chapter
- **Browse** — ask "what chapters do you have?" for the full index

When you ask about something not in Core Frameworks below, I read the relevant chapter file before answering.

---

## Core Frameworks & Mental Models

**What a subagent is.** A specialized AI assistant in its own isolated context window, with a custom system prompt, specific tool access, and independent permissions. Use one when a side task would flood your main conversation with output you won't reuse, or when you keep spawning the same kind of worker. It returns only a summary.

**Subagent vs main vs fork vs skill (the core decision):**
- Verbose, self-contained output you won't reuse, or tool restrictions to enforce → **subagent**.
- Iterative back-and-forth, shared context, quick edit, latency-sensitive → **main conversation**.
- Side task needing all current context → **fork** (`/fork ...`) — inherits everything, shares prompt cache.
- Reusable prompt/workflow in main context → **Skill**. Quick question on current context → **`/btw`**. Sustained parallelism past context window → **agent teams**.

**The file.** Markdown + YAML frontmatter. Only `name` + `description` required; body = the system prompt (subagent gets only this, not the full Claude Code prompt). Store by scope — priority: **managed > `--agents` flag > project `.claude/agents/` > user `~/.claude/agents/` > plugin**. Higher wins on same `name`; duplicate `name` in one scope is silently dropped. Disk edits need a restart; `/agents` edits are live.

**Tool control.** Inherits all tools by default. `tools` = allowlist (drops MCP unless listed); `disallowedTools` = denylist (keeps MCP). Both set → deny first, then allowlist on the remainder. `mcp__<server>` scopes a whole server; `mcp__*` drops all MCP. UI tools (`AskUserQuestion`, `EnterPlanMode`, `ScheduleWakeup`, `WaitForMcpServers`) never reach subagents.

**Spawning.** `tools: Agent(worker, researcher)` allowlists spawnable types — but only for a `--agent` main thread; ignored in subagent defs. Bare `Agent` = any; omit `Agent` = none. `permissions.deny: ["Agent(name)"]` blocks a specific agent. Nesting allowed to **depth 5** (depth-5 agent can't spawn).

**Model resolution (first set wins):** `CLAUDE_CODE_SUBAGENT_MODEL` env → per-invocation param → frontmatter `model` → main model (default `inherit`). Route cheap/high-volume to `haiku`.

**Permission-mode precedence:** parent `bypassPermissions`/`acceptEdits` force the child (can't override); parent `auto` makes the child inherit auto and ignores its `permissionMode`.

**Skills & memory.** `skills:` preloads full skill content at startup (preload ≠ access control). `memory:` (`user`/`project`/`local`) gives a persistent directory; `project` is the default; only the first 200 lines/25KB of `MEMORY.md` loads.

**Hooks.** Frontmatter hooks (`PreToolUse`/`PostToolUse`/`Stop`→`SubagentStop`) run while that subagent is active — `PreToolUse` + exit code 2 = conditional block (finer than `tools`). `settings.json` `SubagentStart`/`SubagentStop` watch lifecycle in main. Plugin subagents ignore `hooks`/`mcpServers`/`permissionMode`.

**Invocation escalation:** natural language (Claude decides) → @-mention (guaranteed, this task) → `--agent`/`agent` setting (session-wide; replaces default system prompt). Add "use proactively" to `description` for eager auto-delegation.

**Context at startup.** A fresh non-fork subagent gets: own prompt + env, delegation message, CLAUDE.md + memory hierarchy, git snapshot, preloaded skills. It does NOT see your history, invoked skills, or files already read — restate critical rules in the prompt. **Explore & Plan are the only agents that skip CLAUDE.md + git** (for speed). Resume via `SendMessage` (Explore/Plan are one-shot, can't resume).

**Forks** inherit the full conversation (no input isolation), share the prompt cache (cheaper than a fresh subagent), run in the background, and can't nest. Use to avoid re-explaining or to try parallel approaches from one start.

---

## Chapter Index

| # | Title | Key Topics |
|---|-------|-----------|
| [ch01](chapters/ch01-built-in-subagents.md) | Built-in Subagents | Explore, Plan, general-purpose, helpers, disabling |
| [ch02](chapters/ch02-scope-and-locations.md) | Scope & Storage Locations | scope priority, `/agents`, `--agents`, discovery rules |
| [ch03](chapters/ch03-write-files-and-frontmatter.md) | Write Files & Frontmatter | file format, all frontmatter fields, load timing |
| [ch04](chapters/ch04-choose-a-model.md) | Choose a Model | aliases, full IDs, `inherit`, resolution order |
| [ch05](chapters/ch05-control-tools-and-spawning.md) | Control Tools & Spawning | tools/disallowedTools, MCP patterns, `Agent()` |
| [ch06](chapters/ch06-mcp-servers-and-permission-modes.md) | MCP Servers & Permission Modes | inline vs reference MCP, permission modes, precedence |
| [ch07](chapters/ch07-preload-skills-and-memory.md) | Preload Skills & Memory | `skills` preload, `memory` scopes, `MEMORY.md` |
| [ch08](chapters/ch08-hooks-and-disabling.md) | Hooks & Disabling | frontmatter vs settings hooks, conditional validation, deny |
| [ch09](chapters/ch09-delegation-and-invocation.md) | Delegation & Invocation | auto-delegation, @-mention, `--agent`, `agent` setting |
| [ch10](chapters/ch10-patterns-and-when-to-use.md) | Patterns & When to Use | isolate/parallel/chain, subagent vs main |
| [ch11](chapters/ch11-nested-and-context-management.md) | Nested & Context Management | depth limit, what loads, resume, compaction |
| [ch12](chapters/ch12-fork-the-conversation.md) | Fork the Conversation | fork vs named, prompt cache, env vars, panel |

## Topic Index

- **acceptEdits / auto / bypassPermissions / dontAsk / plan** → ch06
- **`--agent` / `agent` setting** → ch09
- **`--agents` JSON** → ch02
- **`Agent(agent_type)` spawn allowlist** → ch05
- **background / foreground** → ch10, ch12
- **built-in subagents (Explore, Plan, general-purpose)** → ch01
- **CLAUDE.md / git status loading** → ch11
- **compaction** → ch11
- **delegation** → ch09
- **description / proactive delegation** → ch03, ch09
- **disable subagents (`permissions.deny`)** → ch08
- **disallowedTools** → ch05
- **effort / color / maxTurns / initialPrompt** → ch03
- **fork** → ch12
- **frontmatter fields (reference)** → ch03
- **hooks (PreToolUse/PostToolUse/Stop, SubagentStart/Stop)** → ch08
- **isolation: worktree** → ch03, ch12
- **MCP servers (inline / reference / restrictions)** → ch06, ch05
- **memory / MEMORY.md** → ch07
- **model / model resolution** → ch04
- **name / identity** → ch02, ch03
- **nested subagents / depth limit** → ch11
- **patterns (isolate, parallel, chain)** → ch10
- **permission modes** → ch06
- **plugin subagents** → ch02, ch08
- **resume / SendMessage / transcripts** → ch11
- **scope priority / project / user** → ch02
- **skills (preload)** → ch07
- **subagent vs main vs skill vs /btw** → ch10
- **tools (allowlist)** → ch05

## Supporting Files

- [glossary.md](glossary.md) — every term, field, env var, and event with definitions
- [patterns.md](patterns.md) — reusable subagent configurations and workflows
- [cheatsheet.md](cheatsheet.md) — decision rules and quick-reference tables

---

## Scope & Limits

Covers the "Create custom subagents" documentation only (subagent definition, config, invocation, context, forks). For related features — plugins, the Agent SDK / headless mode, MCP setup, agent teams, hooks internals — see their own docs. Version-gated behaviors (e.g. fork mode, nested subagents) note the minimum Claude Code version inline.
