---
name: claude-code-skills
description: "Knowledge base from \"Extend Claude with skills\" (Claude Code docs). Use when authoring or debugging Claude Code skills — SKILL.md frontmatter, invocation control (disable-model-invocation/user-invocable), allowed-tools, string substitutions, context:fork subagents, dynamic !command injection, skillOverrides, evaluation, or troubleshooting triggering."
disableSkillShellExecution: true
---

<!-- argument-hint: [topic, frontmatter field, or chapter number] -->

# Extend Claude with Skills
**Author**: Claude Code documentation (code.claude.com/docs/en/skills) | **Pages**: ~16 sections | **Chapters**: 8 | **Generated**: 2026-06-23

## How to Use This Skill

- **Without arguments** — load core frameworks below for reference
- **With a topic** — ask about `frontmatter`, `context:fork`, `allowed-tools`, `skillOverrides`; I find and read the relevant chapter
- **With chapter** — ask for `ch05`; I load that specific chapter
- **Browse** — ask "what chapters do you have?" for the full index

When you ask about something not in Core Frameworks, I read the relevant chapter file first.

---

## Core Frameworks & Mental Models

**What a skill is** — a directory with a required `SKILL.md` (frontmatter + markdown body) that Claude adds to its toolkit and loads **only when used**. Invoke automatically (Claude decides) or directly with `/skill-name`. Follows the Agent Skills open standard; Claude Code extends it with invocation control, `context: fork`, and dynamic injection.

**Skill vs CLAUDE.md** — *facts/always-relevant* → CLAUDE.md (always in context). *Procedures/multi-step/long reference* → skill (loads on use, ~free until invoked). Trigger to make one: you keep pasting the same checklist, or a CLAUDE.md section grew into a procedure.

**Commands = Skills (merged)** — `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both make `/deploy`. Old command files keep working; skills add supporting files, invocation control, auto model-loading. Prefer skills for new work.

**Reference vs Task content** — *Reference*: conventions/style/domain knowledge applied inline (no task). *Task*: numbered action steps, usually `disable-model-invocation: true`, often `context: fork`. Keep the body concise — once loaded it persists across turns, so every line is a recurring token cost; state *what*, not *how/why*.

**Who-invokes control (two axes)** —
- `disable-model-invocation: true` → **you only** (gate risky side effects: deploy/commit/slack); also removes description from context + blocks subagent preload.
- `user-invocable: false` → **Claude only** (background knowledge; hidden from `/` menu). ⚠️ This hides the menu *only* — to block Claude, use `disable-model-invocation`.

**Command name = filesystem path, not `name:`** — `.claude/skills/X/` → `/X`; nested clash → `apps/web:deploy`; plugin → `plugin:skill`. `name:` is display-only except in a plugin-root `SKILL.md`. Want a different command? Rename the directory.

**`description` is the router** — the only thing Claude sees before loading. Key use case FIRST, keyword-rich; `description` + `when_to_use` capped at 1,536 chars; listing budget ≈ 1% of context window.

**Pre-approve tools (`allowed-tools`)** — grants prompt-free use of listed tools while active; **grants, never restricts**. Project-level activates only after workspace trust → review skills first (a skill can grant itself broad access). `disallowed-tools` removes tools for one turn (clears next message); durable blocks → permission deny rules.

**Argument substitution** — `$ARGUMENTS` (full string), `$ARGUMENTS[N]`/`$N` (positional), `$name` (via `arguments:` frontmatter). Quote multi-word args. Missing `$ARGUMENTS` → Claude Code appends `ARGUMENTS: <input>`. Portable script path anchor: `${CLAUDE_SKILL_DIR}`.

**Dynamic context injection (bang syntax)** — a `!` immediately followed by a backtick-wrapped shell command (bang-backtick-CMD-backtick) runs shell BEFORE Claude sees content; stdout replaces the placeholder. Preprocessing, not execution; single pass (output not re-scanned); `!` must start a line / follow whitespace. Multi-line → fenced ` ```! ` block. Policy kill → `disableSkillShellExecution: true`.

**Fork execution (`context: fork`)** — runs the skill as an isolated subagent; SKILL.md content becomes the prompt; no conversation history. Pick executor with `agent:` (`Explore`/`Plan`/`general-purpose`/custom; default `general-purpose`). Explore/Plan skip CLAUDE.md + git status. Only works for skills with a real task.

**Lifecycle & compaction** — invoked content enters as one message and persists (not re-read) → write standing instructions. After compaction: first 5,000 tokens/skill kept, 25,000 combined, most-recent-first; re-invoke big/important skills. "Stopped working" usually = still loaded but model chose other tools → strengthen description or use hooks.

**Discovery & precedence** — loads from start dir + every parent to repo root + nested dirs on demand. Same-name precedence: enterprise > personal > project; any level > bundled; skill > command; plugin skills namespaced (collision-proof). New top-level dir → restart; in-dir edits → live. `--add-dir` loads skills (exception); `additionalDirectories` setting does not.

**Eval = baseline comparison** — fresh session, with-skill vs without-skill, compare; measure trigger-rate AND output quality separately. Authoring context masks gaps. Automate with the `skill-creator` plugin.

---

## Chapter Index

| # | Title | Key Frameworks |
|---|-------|----------------|
| [ch01](chapters/ch01-skills-overview-and-bundled.md) | What Skills Are & Bundled Skills | stop-pasting trigger, commands=skills, Agent Skills standard, /run-/verify trio |
| [ch02](chapters/ch02-where-skills-live.md) | Where Skills Live, Precedence & Discovery | 4 storage levels, precedence chain, nested/qualified, live change detection |
| [ch03](chapters/ch03-content-types-and-frontmatter.md) | Content Types & Frontmatter Reference | reference vs task, conciseness test, full frontmatter table |
| [ch04](chapters/ch04-command-naming-and-substitutions.md) | Command Naming, Substitutions & Supporting Files | name-from-path, $ARGUMENTS family, ${CLAUDE_SKILL_DIR}, progressive disclosure |
| [ch05](chapters/ch05-invocation-control-and-lifecycle.md) | Invocation Control & Lifecycle | two-axis control, invoke-once-standing, compaction budget |
| [ch06](chapters/ch06-tools-and-arguments.md) | Pre-approving Tools & Passing Arguments | grant-not-restrict, single-turn removal, workspace trust |
| [ch07](chapters/ch07-dynamic-context-and-fork.md) | Dynamic Context Injection & Subagent Fork | `!` injection, context:fork, skill⇄subagent directions |
| [ch08](chapters/ch08-restrict-eval-share-troubleshoot.md) | Restrict, Override, Evaluate, Share & Troubleshoot | 3 restrict methods, baseline eval, skillOverrides, /doctor |

## Topic Index

- **`agent` field** → ch07
- **`allowed-tools`** → ch03, ch06
- **arguments / `$ARGUMENTS` / `$N` / `$name`** → ch03, ch04
- **bundled skills** → ch01
- **`${CLAUDE_SKILL_DIR}` / substitutions** → ch04
- **command naming / `/command`** → ch04
- **`context: fork` / subagents** → ch07
- **`description` / `when_to_use`** → ch03, ch08
- **`disable-model-invocation`** → ch03, ch05
- **`disableSkillShellExecution`** → ch07
- **`disallowed-tools`** → ch03, ch06
- **discovery / `--add-dir` / nested** → ch02
- **dynamic injection (`!` syntax)** → ch07
- **eval / `skill-creator`** → ch08
- **frontmatter reference** → ch03
- **lifecycle / compaction** → ch05
- **`paths`** → ch03
- **plugin skills / namespacing** → ch02, ch04
- **precedence / overrides (same name)** → ch02
- **`/run` `/verify` `/run-skill-generator`** → ch01
- **sharing skills** → ch08
- **`skillOverrides`** → ch08
- **storage levels (enterprise/personal/project/plugin)** → ch02
- **supporting files / progressive disclosure** → ch04
- **troubleshooting / `/doctor` / `--debug`** → ch08
- **`user-invocable`** → ch03, ch05, ch08
- **visual output scripts** → ch08
- **workspace trust** → ch06

## Supporting Files

- [glossary.md](glossary.md) — all frontmatter fields, substitutions, and terms with definitions
- [patterns.md](patterns.md) — reusable skill patterns (reference, task, fork, injection, eval, visual output)
- [cheatsheet.md](cheatsheet.md) — decision rules, thresholds, and troubleshooting tells

---

## Scope & Limits

Covers the "Extend Claude with skills" documentation only. For hands-on skill authoring in this repo, combine with project tooling and the `book-to-skill` skill. For subagents, hooks, plugins, permissions, and memory internals, see the linked Claude Code docs or related skills.
