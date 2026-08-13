# Glossary — Claude Code Skills

**Agent Skills standard** — open cross-tool standard ([agentskills.io](https://agentskills.io/)) that Claude Code skills follow; Claude Code extends it with invocation control, fork execution, and dynamic injection (Ch 1).

**`agent` (frontmatter)** — which subagent type executes a `context: fork` skill; built-in `Explore`/`Plan`/`general-purpose` or a custom `.claude/agents/` agent; defaults to `general-purpose` (Ch 7).

**`allowed-tools`** — pre-approves listed tools (no prompt) while the skill is active; grants, never restricts; project-level needs workspace trust (Ch 3, Ch 6).

**`argument-hint`** — autocomplete hint for expected args, e.g. `[issue-number]` (Ch 3).

**`arguments`** — named positional args enabling `$name` substitution; space-separated string or YAML list (Ch 3, Ch 4).

**`$ARGUMENTS` / `$ARGUMENTS[N]` / `$N`** — full arg string / 0-based positional / shorthand for positional (Ch 4).

**Baseline comparison** — eval method: run prompts in fresh sessions with vs. without the skill, compare (Ch 8).

**Built-in command** — fixed-logic command run directly (e.g. `/help`, `/compact`); not prompt-based (Ch 1).

**Bundled skill** — prompt-based skill shipped in every session (e.g. `/code-review`, `/batch`, `/debug`, `/loop`); disable via `disableBundledSkills` (Ch 1).

**`${CLAUDE_EFFORT}`** — current effort level substitution: `low`/`medium`/`high`/`xhigh`/`max` (ultracode = `xhigh`) (Ch 4).

**`${CLAUDE_SESSION_ID}`** — current session ID substitution (Ch 4).

**`${CLAUDE_SKILL_DIR}`** — directory containing the skill's `SKILL.md`; portable path anchor for bundled scripts (Ch 4, Ch 8).

**Command name** — `/command` you type; derived from the skill's filesystem location, not `name` (except plugin-root) (Ch 4).

**`context: fork`** — runs the skill as an isolated subagent; SKILL.md content becomes the prompt; no conversation history (Ch 7).

**Description budget** — char budget for skill listings, ~1% of context window; tune via `skillListingBudgetFraction` / `SLASH_COMMAND_TOOL_CHAR_BUDGET` (Ch 8).

**`disable-model-invocation`** — `true` = only you can invoke; removes description from context; blocks subagent preload (Ch 3, Ch 5).

**`disableSkillShellExecution`** — setting that replaces each `!` command with a disabled-by-policy placeholder (Ch 7).

**`disallowed-tools`** — removes listed tools from the pool while active; clears on next user message (Ch 3, Ch 6).

**Dynamic context injection** — `` !`<command>` `` runs shell before Claude sees content; output replaces placeholder (Ch 7).

**`effort` (frontmatter)** — effort level while the skill is active; overrides session (Ch 3).

**Enterprise skill** — managed-settings skill for all users in an org; highest precedence (Ch 2).

**Live change detection** — watched-dir `SKILL.md` edits take effect mid-session; new top-level dirs need restart (Ch 2).

**`maxSkillDescriptionChars`** — configurable per-entry description cap (default 1,536) (Ch 3, Ch 8).

**`model` (frontmatter)** — model while skill active; applies rest of turn, not saved; or `inherit` (Ch 3).

**Name-from-path rule** — command name comes from the skill's location; `name:` is display-only except plugin-root (Ch 4).

**Nested skill** — skill in a subdir's `.claude/skills/`; on clash gets a qualified name like `apps/web:deploy` (Ch 2, Ch 4).

**`paths`** — globs limiting auto-activation to matching files (Ch 3).

**Personal skill** — `~/.claude/skills/`; applies to all your projects (Ch 2).

**Plugin skill** — `<plugin>/skills/`; namespaced `plugin:skill`; collision-proof (Ch 2).

**Project skill** — `.claude/skills/`; this project only; commit to share (Ch 2).

**Reference content** — skill body of knowledge/conventions applied inline (Ch 3).

**`shell` (frontmatter)** — `bash` (default) or `powershell` for `!` blocks (Ch 3).

**Skill** — directory with required `SKILL.md`; loads on demand (Ch 1).

**`Skill(name)` / `Skill(name *)`** — permission rules: exact / prefix match for allow/deny (Ch 8).

**`skill-creator`** — plugin automating the eval/comparison loop (Ch 8).

**`skillOverrides`** — settings-side visibility control: `on`/`name-only`/`user-invocable-only`/`off` (Ch 8).

**Skill content lifecycle** — invoked content enters as one message and persists; not re-read; carried through compaction (Ch 5).

**Task content** — skill body of step-by-step actions, usually manual-invoked (Ch 3).

**`ultrathink`** — keyword in skill content requesting deeper reasoning (Ch 7).

**`user-invocable`** — `false` = only Claude invokes (hidden from `/` menu); visibility only (Ch 3, Ch 5, Ch 8).

**`when_to_use`** — extra trigger phrases appended to description; counts toward the cap (Ch 3).

**Workspace trust** — project `allowed-tools` activate only after trusting the folder (Ch 6).
