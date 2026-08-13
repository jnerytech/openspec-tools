# Chapter 3: Skill Content Types & Frontmatter Reference

## Core Idea
A skill is YAML frontmatter + markdown body. Decide content by **how you'll invoke it**: *reference content* (knowledge applied inline) vs *task content* (step-by-step actions you trigger with `/name`). Only `description` is recommended; all fields optional.

## Frameworks Introduced
- **Reference content vs Task content** — the two shapes a skill body takes.
  - When to use: reference for conventions/patterns/style/domain knowledge that runs inline alongside conversation; task for deployments/commits/codegen you invoke directly.
  - How: task content usually adds `disable-model-invocation: true` so Claude won't auto-fire it; often `context: fork` to run isolated.
- **Conciseness test** — keep the body itself short.
  - When to use: every skill — once loaded, content stays in context across turns, so every line is a *recurring* token cost.
  - How: state *what to do*, not *how/why*; apply the same test as for effective CLAUDE.md. Move long material to supporting files.

## Key Concepts
- **`description`**: what the skill does + when to use it; Claude matches on this. Put key use case first — combined `description` + `when_to_use` truncates at **1,536 characters** in the listing.
- **`when_to_use`**: trigger phrases / example requests; appended to description, counts toward the 1,536-char cap.
- **`disable-model-invocation`**: `true` = only you invoke (manual `/name`); also blocks preloading into subagents.
- **`user-invocable`**: `false` = only Claude invokes (hidden from `/` menu).
- **`paths`**: glob patterns that gate auto-activation to matching files.

## Mental Models
- Treat the skill body as a **standing instruction that bills every turn** — write it like a tight checklist, not prose.
- `description` is the **router**: it's the only thing Claude sees before deciding to load. Keyword-rich, use-case-first.

## Anti-patterns
- **Narrating how/why in the body**: wastes recurring tokens. State the action.
- **Burying the key use case late in `description`**: it may be truncated at 1,536 chars and lose the matching keywords.
- **Omitting `description`**: Claude falls back to the first paragraph and may never match the skill.

## Reference Tables
**Frontmatter fields (all optional; `description` recommended):**

| Field | Description |
| --- | --- |
| `name` | Display label in listings. Defaults to directory name. Does *not* set the invoke command (except plugin-root `SKILL.md`). |
| `description` | What + when. Used for matching. Key use case first; capped 1,536 chars with `when_to_use`. |
| `when_to_use` | Extra trigger phrases/examples. Appended to description; counts toward cap. |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]` or `[filename] [format]`. |
| `arguments` | Named positional args for `$name` substitution. Space-separated string or YAML list; map to positions in order. |
| `disable-model-invocation` | `true` → only manual `/name`; also blocks subagent preload. Default `false`. |
| `user-invocable` | `false` → hide from `/` menu (Claude-only). Default `true`. |
| `allowed-tools` | Tools usable without prompting while active. String or YAML list. |
| `disallowed-tools` | Tools removed from pool while active (clears on next message). |
| `model` | Model while active; applies rest of turn, not saved. Same values as `/model`, or `inherit`. |
| `effort` | Effort while active: `low`/`medium`/`high`/`xhigh`/`max`. Default inherits session. |
| `context` | `fork` → run in a forked subagent context. |
| `agent` | Which subagent type when `context: fork`. |
| `hooks` | Hooks scoped to this skill's lifecycle. |
| `paths` | Globs limiting auto-activation to matching files. |
| `shell` | `bash` (default) or `powershell` for `!` shell blocks (PowerShell needs `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`). |

## Worked Example
**Reference content** — applied inline, no task:
```yaml
---
name: api-conventions
description: API design patterns for this codebase
---

When writing API endpoints:
- Use RESTful naming conventions
- Return consistent error formats
- Include request validation
```
**Task content** — explicit steps, manual-only, isolated:
```yaml
---
name: deploy
description: Deploy the application to production
context: fork
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

## Key Takeaways
1. Reference = inline knowledge; task = invoked actions (usually `disable-model-invocation: true`).
2. The body is a recurring cost — keep it concise, state actions not narration.
3. `description` is the matcher: key use case first, keyword-rich, under the 1,536-char cap.
4. `paths` gates auto-activation; `disable-model-invocation`/`user-invocable` gate who can invoke.
5. `model`/`effort` overrides apply only while the skill is active in the current turn.

## Connects To
- **Ch 4**: `arguments` + string substitutions; supporting files keep the body lean.
- **Ch 5**: `disable-model-invocation` / `user-invocable` invocation-control deep dive + lifecycle.
- **Ch 6**: `allowed-tools` / `disallowed-tools` tool permissions.
- **Ch 7**: `context: fork` / `agent` / `hooks` advanced execution.
