# Patterns — Claude Code Skills

## Reference Content Skill (inline knowledge)
**When to use**: conventions, style guides, domain knowledge Claude should apply alongside the current conversation.
**How**: minimal frontmatter (`name` + `description`), body of rules. No task, no `disable-model-invocation`.
**Trade-offs**: stays in context across turns once loaded — keep it tight; every line is recurring cost.

## Task Content Skill (invoked action)
**When to use**: deployments, commits, codegen — actions you want to trigger by `/name` and control the timing of.
**How**: numbered steps in body; add `disable-model-invocation: true`; often `context: fork` for isolation.
**Trade-offs**: manual-only means Claude won't auto-help; you trade convenience for safety on side effects.

## Per-project Launch Recipe (`/run-skill-generator`)
**When to use**: `/run` or `/verify` inference fails because the app needs a DB, env file, graphical session, or multi-step build.
**How**: run `/run-skill-generator` once; it captures install commands, env vars, launch script and commits `.claude/skills/run-<name>/`.
**Trade-offs**: one-time setup; re-run when build/launch changes. Requires Claude Code v2.1.145+.

## Dynamic Context Injection (`!` syntax)
**When to use**: the skill needs live state (PR diff, git status, versions), not guesses.
**How**: `` - PR diff: !`gh pr diff` `` at line start / after whitespace; multi-line via fenced ` ```! ` block. Pair with `allowed-tools` for the commands' tools.
**Trade-offs**: single pass, output not re-scanned; preprocessing only (Claude never runs it); killable by `disableSkillShellExecution`.

## Fork Execution (`context: fork`)
**When to use**: research/analysis you want sandboxed from main context.
**How**: `context: fork` + `agent: Explore|Plan|general-purpose|<custom>`. SKILL.md content becomes the subagent prompt.
**Trade-offs**: no conversation history; needs a real task (guidelines-only forks return nothing); Explore/Plan skip CLAUDE.md + git status.

## Pre-approve Tools (`allowed-tools`)
**When to use**: a task skill runs known commands (git, gh) and you want no per-use prompts.
**How**: `allowed-tools: Bash(git add *) Bash(git commit *)`. Project-level activates on workspace trust.
**Trade-offs**: grants only, never restricts; review project skills before trusting — a skill can grant itself broad access.

## Single-turn Tool Removal (`disallowed-tools`)
**When to use**: autonomous/background skill that must never call a tool (e.g. `AskUserQuestion` in a loop).
**How**: `disallowed-tools: AskUserQuestion`.
**Trade-offs**: clears on your next message — not a durable block; use permission deny rules for that.

## Argument Parameterization
**When to use**: same procedure over varying inputs (fix issue N, migrate X→Y).
**How**: `$ARGUMENTS` for whole string; `$ARGUMENTS[N]`/`$N` positional; named `$name` via `arguments:` frontmatter. Quote multi-word args.
**Trade-offs**: missing `$ARGUMENTS` → Claude Code appends `ARGUMENTS: <input>` automatically.

## Supporting Files (progressive disclosure)
**When to use**: SKILL.md approaching 500 lines; large reference docs, specs, examples, scripts.
**How**: split into `reference.md`/`examples.md`/`scripts/`; reference each from SKILL.md so Claude knows when to load. Scripts execute, don't load.
**Trade-offs**: detail loads only when needed — near-zero cost until used.

## Visual Output Script
**When to use**: interactive HTML reports (codebase tree, dependency graph, coverage, schema).
**How**: bundle a script; instruct Claude to run `python3 ${CLAUDE_SKILL_DIR}/scripts/x.py .`; `allowed-tools: Bash(python3 *)`.
**Trade-offs**: script does the work, Claude orchestrates; portable across install levels via `${CLAUDE_SKILL_DIR}`.

## Baseline-Comparison Eval
**When to use**: confirming a skill triggers correctly AND improves output.
**How**: realistic prompts, fresh sessions with vs. without skill, compare. Automate with `skill-creator` plugin (test cases → grading → benchmark → A/B → description tuning).
**Trade-offs**: must use fresh sessions — authoring context masks gaps. Measure trigger-rate and quality separately.

## Override Skill Visibility (`skillOverrides`)
**When to use**: skills you can't/won't edit (shared repo, MCP-provided).
**How**: set `on`/`name-only`/`user-invocable-only`/`off` in `.claude/settings.local.json`; `/skills` menu writes it (Space cycles, Enter saves).
**Trade-offs**: doesn't affect plugin skills (manage via `/plugin`). `name-only` frees description budget.
