# Chapter 8: Restricting Access, Overrides, Evaluating, Sharing & Troubleshooting

## Core Idea
Control *which* skills Claude can invoke (permission rules, frontmatter, `skillOverrides`), prove a skill works via baseline comparison (with vs. without), share at the right scope, and diagnose triggering problems systematically.

## Frameworks Introduced
- **Three ways to restrict Claude's skill access.**
  - When to use: locking down what Claude can auto-invoke.
  - How: (1) deny the `Skill` tool entirely; (2) allow/deny specific skills with `Skill(name)` / `Skill(name *)`; (3) hide individual skills with `disable-model-invocation: true` (removes them from context entirely).
- **Baseline comparison eval** — the only honest test.
  - When to use: confirming a skill both *triggers* on the right prompts AND *produces* the right output.
  - How: collect realistic prompts; run each in a **fresh** session with the skill enabled and again disabled; compare. Fresh sessions matter — authoring context masks gaps.
- **`skillOverrides` visibility control** — manage skills you can't/won't edit.
  - When to use: skills in a shared repo or from an MCP server.
  - How: set each to `on` / `name-only` / `user-invocable-only` / `off` in `.claude/settings.local.json`; the `/skills` menu writes it (Space cycles, Enter saves).

## Key Concepts
- **`Skill(name)`** = exact match; **`Skill(name *)`** = prefix match with any args.
- **`user-invocable: false`** controls *menu visibility only*, NOT Skill-tool access — use `disable-model-invocation: true` to block programmatic invocation.
- **Built-ins via Skill tool**: `/init`, `/review`, `/security-review` are available; `/compact` and similar are not.
- **`skill-creator` plugin**: automates the comparison loop (test cases → isolated runs → grading → benchmark → A/B version comparison → description tuning → review viewer).
- **Description budget**: scales at **1% of context window** (`skillListingBudgetFraction` or `SLASH_COMMAND_TOOL_CHAR_BUDGET`); per-entry cap **1,536 chars** (`maxSkillDescriptionChars`).

## Mental Models
- "Triggered" ≠ "worked": measure invocation rate and output quality **separately**.
- `skillOverrides` is **external visibility control** — your settings, not the skill's frontmatter — for skills you don't own.
- Description shortening is **budget pressure**: least-used skills lose their descriptions first; free budget with `name-only`.

## Anti-patterns
- **Evaluating in the authoring session**: leftover context hides missing instructions. Always use fresh sessions.
- **Using `user-invocable: false` to block Claude**: it only hides the menu; Claude still invokes. Use `disable-model-invocation: true`.
- **Vague descriptions**: skill won't trigger (missing keywords) or triggers too often (too broad).

## Reference Tables
**`skillOverrides` states:**

| Value | Listed to Claude | In `/` menu |
| --- | --- | --- |
| `on` (default if absent) | Name + description | Yes |
| `name-only` | Name only | Yes |
| `user-invocable-only` | Hidden | Yes |
| `off` | Hidden | Hidden |

**Restrict-access methods:**

| Goal | Mechanism |
| --- | --- |
| Disable all skills | Deny `Skill` tool in `/permissions` |
| Allow specific | `Skill(commit)`, `Skill(review-pr *)` |
| Deny specific | `Skill(deploy *)` |
| Hide one from Claude | `disable-model-invocation: true` |

**Share scopes:** project (commit `.claude/skills/`), plugin (`skills/` dir), managed (org-wide via managed settings).

## Worked Example
**Troubleshooting flow** — *skill not triggering*: (1) check description has keywords users would say; (2) verify it shows under "What skills are available?"; (3) rephrase request to match description; (4) invoke directly `/skill-name`. If frontmatter YAML is malformed, Claude Code loads the body with empty metadata — `/skill-name` still works but there's no `description` to match; run `--debug` to see the parse error. *Triggers too often*: make description more specific, or add `disable-model-invocation: true`. *Descriptions cut short*: run `/doctor` to see how many are shortened/dropped; raise `skillListingBudgetFraction` (e.g. `0.02`) or set low-priority skills to `name-only`.

**`skillOverrides` example** (`.claude/settings.local.json`):
```json
{
  "skillOverrides": {
    "legacy-context": "name-only",
    "deploy": "off"
  }
}
```

**Visual-output pattern**: a skill bundles a script (e.g. `visualize.py`) and instructs Claude to run it via `python3 ${CLAUDE_SKILL_DIR}/scripts/visualize.py .`, generating an interactive HTML report. The script does the work; Claude orchestrates. Works for dependency graphs, coverage reports, schema diagrams.

## Key Takeaways
1. Restrict skills three ways: deny `Skill` tool, `Skill(name)`/`Skill(name *)` rules, or `disable-model-invocation: true`.
2. `user-invocable: false` hides the menu only; block Claude with `disable-model-invocation: true`.
3. Eval = baseline comparison in fresh sessions, measuring trigger-rate and output-quality separately; `skill-creator` automates it.
4. `skillOverrides` (on/name-only/user-invocable-only/off) controls visibility from settings for skills you don't own.
5. Troubleshoot triggering via description keywords, `/doctor` for budget, `--debug` for YAML parse errors.

## Connects To
- **Ch 3**: `description` quality drives both triggering and the budget cap.
- **Ch 5**: `disable-model-invocation` / `user-invocable` are the frontmatter side of access control.
- **Ch 7**: visual-output scripts reuse `${CLAUDE_SKILL_DIR}` and the orchestration model.
