# Cheatsheet — Claude Code Skills

## Skill vs CLAUDE.md — decision rule
- **Fact / always-relevant** → CLAUDE.md (always in context).
- **Procedure / multi-step / long reference** → skill (loads on use, ~free until invoked).
- Tell: you keep pasting the same checklist, or a CLAUDE.md section became a procedure → make a skill.

## Who-invokes — pick by risk vs relevance
| Want | Set | Effect |
| --- | --- | --- |
| Both (default) | nothing | Description in context; loads on invoke |
| You only (risky side effects: deploy/commit/slack) | `disable-model-invocation: true` | Claude can't fire it; description NOT in context |
| Claude only (background knowledge) | `user-invocable: false` | Hidden from `/` menu; Claude still uses it |
- ⚠️ `user-invocable: false` hides the menu only — to *block Claude* use `disable-model-invocation: true`.

## Reference vs Task content
- Conventions/style/domain → **reference** (no task, runs inline).
- Steps with side effects → **task** (`disable-model-invocation: true`, often `context: fork`).

## Tool permissions
| Need | Use | Durable? |
| --- | --- | --- |
| No prompt for known tools | `allowed-tools: Bash(git *)` | grants only |
| Remove a tool this turn | `disallowed-tools: AskUserQuestion` | clears next msg |
| Block everywhere | permission deny rules | yes |
- `allowed-tools` **grants, never restricts**. Project-level needs workspace trust → review skills first.

## Command name comes from PATH, not `name:`
- `.claude/skills/X/` → `/X`. Nested clash → `apps/web:deploy`. Plugin → `plugin:skill`. Only plugin-root `SKILL.md` uses `name:`.
- Want a different `/command`? Rename the directory.

## `description` rules (it's the router)
- Key use case FIRST, keyword-rich (words users actually say).
- Combined `description` + `when_to_use` capped at **1,536 chars** (`maxSkillDescriptionChars`).
- Listing budget = ~1% context window (`skillListingBudgetFraction`); overflow drops least-used skills' descriptions first.

## Dynamic injection `!` — gotchas
- `` !`cmd` `` must start a line / follow whitespace. `KEY=!`cmd`` → literal, won't run.
- Single pass; output not re-scanned. Preprocessing, Claude never executes it.
- Multi-line → fenced ` ```! ` block. Policy kill → `disableSkillShellExecution: true`.

## `context: fork` — when & how
- Use for sandboxed research/analysis. SKILL.md content = the subagent prompt; no chat history.
- `agent: Explore|Plan` → skips CLAUDE.md + git status (minimal). Else loads CLAUDE.md.
- Needs a real task — guidelines-only fork returns nothing.

## Lifecycle / compaction thresholds
- Invoked skill = one persistent message, **not re-read** each turn → write standing instructions.
- After compaction: first **5,000 tokens** per skill kept, **25,000** combined, most-recent-first. Re-invoke big/important skills after compaction.
- "Skill stopped working" → usually still loaded; strengthen `description`/instructions or enforce with hooks.

## Precedence (same name)
enterprise > personal > project; any level > bundled; skill > command. Plugin skills namespaced → never clash.

## Discovery tells
- Loads from start dir + every parent to repo root + nested dirs on demand.
- New top-level skills dir → **restart**. In-dir `SKILL.md` edits → live.
- `--add-dir` loads `.claude/skills/` (exception); `additionalDirectories` setting does **not**.

## Keep it lean
- SKILL.md < **500 lines**; push detail to supporting files (load on demand). Scripts execute, don't load.
- Body bills every turn → state *what*, not *how/why*.

## Eval rule
- Fresh session, with-skill vs without-skill, compare. Measure trigger-rate AND output quality separately. Automate: `skill-creator`.

## Troubleshooting tells
| Symptom | Check |
| --- | --- |
| Not triggering | description keywords; "What skills are available?"; rephrase; `/skill-name` direct |
| Triggers too often | narrow description; add `disable-model-invocation: true` |
| Description cut short | `/doctor`; raise `skillListingBudgetFraction` (e.g. `0.02`); set others `name-only` |
| Frontmatter ignored | malformed YAML → empty metadata; run `--debug` for parse error |
