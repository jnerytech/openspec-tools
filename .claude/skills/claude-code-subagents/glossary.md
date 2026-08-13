# Glossary — Claude Code Subagents

**`--add-dir`** — Launch flag; its `.claude/agents/` is scanned alongside project subagents (Ch 2).
**`--agent <name>`** — Run the whole session as that subagent; its system prompt replaces the default Claude Code prompt (Ch 9).
**`--agents` (JSON)** — Define session-only subagents at launch; not saved to disk; accepts all frontmatter fields (Ch 2).
**`--strict-mcp-config` / `--bare`** — MCP restrictions that also cover frontmatter-declared servers (v2.1.153+), but NOT inline `--agents`/SDK servers (Ch 6).
**acceptEdits** — Permission mode: auto-accept edits + common FS commands in working dir. Parent's value forces the child's (Ch 6).
**Agent tool** — Tool that spawns subagents (renamed from Task in v2.1.63; `Task(...)` still aliases). Omit it to block spawning (Ch 5).
**`Agent(agent_type)`** — Spawn allowlist syntax in `tools`; only applies to a `--agent` main thread, ignored in subagent defs (Ch 5).
**`agent` setting** — `.claude/settings.json` key making a subagent the project default; CLI flag overrides it (Ch 9).
**agent teams** — Separate feature: each worker its own context, for sustained parallelism beyond your context window (Ch 10).
**agent_type** — Value hooks receive; equals the `name` field (Ch 3, Ch 8).
**auto mode** — Permission mode: a background classifier reviews commands/protected writes. Parent auto forces child; child `permissionMode` ignored (Ch 6).
**background subagent** — Runs concurrently; permission prompts surface in main and name the asker (v2.1.186+) (Ch 10, Ch 12).
**built-in subagent** — Always-registered agent (Explore, Plan, general-purpose, statusline-setup, claude-code-guide) (Ch 1).
**`/btw`** — Quick question over current context, no tools, answer discarded; alternative to a subagent (Ch 10).
**bypassPermissions** — Permission mode: skips prompts; allows writes to `.git`, `.claude`, etc. Parent forces child (Ch 6).
**claude-code-guide** — Built-in Haiku helper for Claude Code feature questions (Ch 1).
**CLAUDE.md** — Memory hierarchy loaded by every subagent except Explore/Plan (Ch 11).
**`CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS`** — `1` removes all built-ins in headless/SDK (Ch 1).
**`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`** — Compaction threshold override; applies to subagents too (Ch 11).
**`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`** — `1` disables all background tasks / keeps spawns synchronous (Ch 10, Ch 12).
**`CLAUDE_CODE_FORK_SUBAGENT`** — `1` enables fork mode (and forces all spawns to background); `0` disables everywhere (Ch 12).
**`CLAUDE_CODE_SUBAGENT_MODEL`** — Env var; highest precedence in model resolution (Ch 4).
**`cleanupPeriodDays`** — Setting governing transcript cleanup (default 30 days) (Ch 11).
**color** — Frontmatter display color in task list/transcript (Ch 3).
**compact_boundary** — Transcript system event logged on compaction, with `preTokens` (Ch 11).
**delegation** — Claude routing a task to a subagent based on task + `description` + context (Ch 9).
**description** — Required frontmatter; tells Claude when to delegate. "use proactively" boosts it (Ch 3, Ch 9).
**disallowedTools** — Denylist; applied before `tools`; supports `mcp__*` patterns (Ch 5).
**dontAsk** — Permission mode: auto-deny prompts (explicitly allowed tools still work) (Ch 6).
**effort** — Frontmatter: `low`/`medium`/`high`/`xhigh`/`max`; overrides session effort (Ch 3).
**Explore** — Built-in Haiku read-only search agent; skips CLAUDE.md/git; one-shot (no resume). Thoroughness: quick/medium/very thorough (Ch 1, Ch 11).
**fork** — Subagent inheriting full conversation context; only its result returns; shares prompt cache; can't nest forks (Ch 12).
**general-purpose** — Built-in all-tools agent for complex multi-step work; resumable (Ch 1, Ch 11).
**hooks** — Lifecycle scripts in frontmatter (scoped) or settings.json (lifecycle). Ignored for plugin subagents (Ch 8).
**includeGitInstructions** — Setting; `false` removes the git-status snapshot (Ch 11).
**inherit** — Default `model` value: use the main conversation's model (Ch 4).
**initialPrompt** — Auto-submitted first user turn when run as main agent (Ch 3).
**isolation: worktree** — Run subagent/fork in a temp git worktree (isolated repo copy); auto-cleaned if no changes (Ch 3, Ch 12).
**managed subagent** — Org-admin-deployed; highest scope priority (Ch 2).
**maxTurns** — Frontmatter: max agentic turns before the subagent stops (Ch 3).
**mcpServers** — Frontmatter: inline (subagent-scoped) or by-name MCP servers. Ignored for plugin subagents (Ch 6).
**memory** — Frontmatter: persistent dir scope (`user`/`project`/`local`); injects first 200 lines/25KB of `MEMORY.md` (Ch 7).
**MEMORY.md** — Curated memory index; first 200 lines or 25KB injected at startup (Ch 7).
**model** — Frontmatter: `sonnet`/`opus`/`haiku`/`fable`/full id/`inherit`. Default `inherit` (Ch 4).
**name** — Required unique id (lowercase+hyphens); sole identity; reaches hooks as `agent_type` (Ch 3).
**nested subagent** — A subagent spawned by another; depth limit 5 (depth-5 can't spawn) (Ch 11).
**permissionMode** — Frontmatter mode; parent bypass/acceptEdits/auto can force/override it; ignored for plugin subagents (Ch 6).
**permissions.deny** — Settings denylist; `Agent(name)` blocks a built-in/custom subagent (Ch 8).
**Plan** — Built-in read-only research agent for plan mode; skips CLAUDE.md/git; one-shot (Ch 1, Ch 11).
**plugin subagent** — From an installed plugin; lowest priority; scoped name; ignores hooks/mcpServers/permissionMode (Ch 2, Ch 8).
**PreToolUse / PostToolUse** — Hook events before/after a tool call; exit code 2 in PreToolUse blocks (Ch 8).
**project subagent** — `.claude/agents/`; codebase-specific; check into VCS (Ch 2).
**prompt cache** — A fork's first request reuses the parent's cache → cheaper than a fresh subagent (Ch 12).
**resume** — Continue an existing subagent with full prior history via `SendMessage` (Ch 11).
**scope priority** — managed(1) > `--agents`(2) > project(3) > user(4) > plugin(5) (Ch 2).
**SendMessage** — Tool to resume a subagent by agent ID or name; stopped agent auto-resumes in background (Ch 11).
**skills (field)** — Preload full skill content at startup; controls preload, not access (Ch 7).
**statusline-setup** — Built-in Sonnet helper run by `/statusline` (Ch 1).
**Stop → SubagentStop** — A frontmatter `Stop` hook auto-converts to `SubagentStop` when run as a subagent (Ch 8).
**SubagentStart / SubagentStop** — settings.json lifecycle hook events matched by agent type name (Ch 8).
**tools (field)** — Allowlist; inherits all if omitted; supports `mcp__<server>` patterns (Ch 5).
**transcript** — `agent-{agentId}.jsonl` under `.../{sessionId}/subagents/`; persists separately from main (Ch 11).
**user subagent** — `~/.claude/agents/`; personal, all your projects (Ch 2).
**worktree** — Temp git worktree branched from default branch for isolated edits (Ch 3, Ch 12).
