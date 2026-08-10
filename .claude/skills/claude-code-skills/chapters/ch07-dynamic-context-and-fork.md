# Chapter 7: Advanced Patterns — Dynamic Context Injection & Subagent Fork

## Core Idea
Two Claude-Code extensions to the Agent Skills standard: `` !`<command>` `` injects **live shell output** into the prompt *before* Claude sees it (preprocessing, not execution), and `context: fork` runs a skill as an **isolated subagent** with no conversation history.

## Frameworks Introduced
- **Dynamic context injection (`!` syntax)** — ground the prompt in real data.
  - When to use: the skill needs current state (PR diff, git status, versions) rather than what Claude can guess.
  - How: write `` - PR diff: !`gh pr diff` ``. Each command runs first; its stdout replaces the placeholder; Claude receives the fully-rendered prompt. Multi-line: open a fenced block with ` ```! `.
- **Fork execution (`context: fork`)** — run the skill in isolation.
  - When to use: research/analysis tasks you want sandboxed from the main context.
  - How: add `context: fork`; the skill content *becomes the subagent's prompt*. Pick the executor with `agent:` (built-in `Explore`/`Plan`/`general-purpose`, or a custom agent from `.claude/agents/`). Defaults to `general-purpose`.

## Key Concepts
- **Preprocessing, not execution**: `!` substitution happens once over the original file before Claude sees anything; Claude only sees the final result.
- **Single-pass**: command output is inserted as plain text and NOT re-scanned — a command can't emit a placeholder for a later pass.
- **Recognition rule**: `!` is recognized only at line start or immediately after whitespace. `KEY=!\`cmd\`` is left literal and does not run.
- **`context: fork` needs a task**: guideline-only skills ("use these API conventions") give the subagent no actionable prompt and return nothing useful.
- **CLAUDE.md loading**: forked skills load CLAUDE.md *except* when `agent: Explore` or `agent: Plan` (those skip CLAUDE.md + git status to stay small).
- **`ultrathink`**: include the word anywhere in skill content to request deeper reasoning.
- **`disableSkillShellExecution: true`**: setting that replaces each `!` command with `[shell command execution disabled by policy]` (bundled/managed skills unaffected; most useful in managed settings).

## Mental Models
- `!` injection = **render-time templating**: think "shell into prompt," run once, no recursion.
- `context: fork` = **detach a worker**: it sees the SKILL.md task + agent system prompt, not your chat. Two directions exist — *skill forks into an agent* vs *agent preloads skills as reference* (see table).

## Anti-patterns
- **Expecting `!` output to contain further placeholders**: not re-scanned; single pass only.
- **Putting `!` mid-line after a character**: `KEY=!\`cmd\`` stays literal — won't run. Keep `!` at line start / after whitespace.
- **Forking a guidelines-only skill**: no task → subagent returns without meaningful output. `context: fork` only makes sense for skills with explicit instructions.
- **Assuming forked skills see your conversation**: they don't — isolated context.

## Reference Tables
**Skill ⇄ subagent, two directions:**

| Approach | System prompt | Task | Also loads |
| --- | --- | --- | --- |
| Skill with `context: fork` | From agent type | SKILL.md content | CLAUDE.md, except Explore/Plan |
| Subagent with `skills` field | Subagent's markdown body | Claude's delegation message | Preloaded skills + CLAUDE.md |

## Worked Example
PR-summary skill that fetches live data, runs in a forked Explore agent, and pre-approves `gh`:
```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
- Changed files: !`gh pr diff --name-only`

## Your task
Summarize this pull request...
```
Execution order: (1) each `` !`<command>` `` runs immediately, before Claude sees anything; (2) output replaces the placeholder; (3) Claude receives the fully-rendered prompt with actual PR data. Because `agent: Explore`, the fork sees only the SKILL.md content + Explore's system prompt (CLAUDE.md and git status skipped).

Multi-line form:
```markdown
## Environment
```!
node --version
npm --version
git status --short
```
```

## Key Takeaways
1. `!` injection is preprocessing — runs once, single pass, output not re-scanned, Claude sees only the result.
2. `!` must start a line or follow whitespace, else it's literal text.
3. `context: fork` runs the skill as an isolated subagent whose prompt IS the SKILL.md; choose executor with `agent:`.
4. Forked skills load CLAUDE.md except under Explore/Plan (which stay minimal).
5. Fork only skills with a real task; add `ultrathink` for deeper reasoning; `disableSkillShellExecution` kills `!` for policy.

## Connects To
- **Ch 4**: `${CLAUDE_SKILL_DIR}` references bundled scripts inside `!` injection commands.
- **Ch 6**: `allowed-tools: Bash(gh *)` pre-approves the injected commands' tools.
- **Ch 8**: Subagents and visual-output scripts extend the same orchestration model.
