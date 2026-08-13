# Chapter 6: Pre-approving Tools & Passing Arguments

## Core Idea
`allowed-tools` pre-approves tools so Claude can use them without prompting while the skill is active — it **grants**, never restricts. `disallowed-tools` removes tools from the pool. Arguments flow in via `$ARGUMENTS` (and positional forms).

## Frameworks Introduced
- **Grant-not-restrict permissions** — `allowed-tools` only adds frictionless access.
  - When to use: a task skill that runs known commands (e.g. git) and you don't want per-use prompts.
  - How: list tool patterns; every other tool remains callable and governed by your normal permission settings.
- **Per-skill tool removal** — `disallowed-tools` shrinks the pool while active.
  - When to use: autonomous/background skills that must never call a tool (e.g. `AskUserQuestion` in a loop).
  - How: list them; the restriction **clears when you send your next message**. To block tools globally, use deny rules in permission settings instead.
- **Argument pass-through** — both you and Claude can pass args.
  - When to use: parameterized skills (fix issue N, migrate X to Y).
  - How: `$ARGUMENTS` for the whole string; `$ARGUMENTS[N]`/`$N` for positions.

## Key Concepts
- **`allowed-tools`**: pre-approval list; does NOT limit availability. Project-level needs the workspace trust dialog accepted first.
- **`disallowed-tools`**: temporary removal from the pool; auto-clears next message.
- **Workspace trust**: project `.claude/skills/` `allowed-tools` activate only after you trust the folder — review skills first, since a skill can grant itself broad access.
- **`$ARGUMENTS` fallback**: if a skill omits `$ARGUMENTS` but you pass args, Claude Code appends `ARGUMENTS: <input>` so Claude still sees them.

## Mental Models
- `allowed-tools` is a **fast-pass lane**, not a fence: it removes prompts, never adds capability. The fence is your permission settings.
- `disallowed-tools` is a **single-turn mute** — good for one autonomous run, gone the moment you reply.
- Treat any project skill with `allowed-tools` as **code you're trusting**: it can grant itself git/Bash access on trust.

## Anti-patterns
- **Using `allowed-tools` to lock a skill down**: it can't — it only widens approval. Use `disallowed-tools` or global deny rules.
- **Trusting a repo without reading its skills**: `allowed-tools` activates on trust and may grant broad tool access.
- **Relying on `disallowed-tools` for lasting blocks**: it clears on your next message; use permission deny rules for durable restrictions.

## Reference Tables
| Field | Effect | Scope | Durable block? |
| --- | --- | --- | --- |
| `allowed-tools` | Pre-approve listed tools (no prompt) | While skill active | No — grants only |
| `disallowed-tools` | Remove listed tools from pool | Until next user message | No — use permission deny |
| Permission deny rules | Block tools everywhere | All skills + prompts | Yes |

## Worked Example
A commit skill that runs git without per-use approval:
```yaml
---
name: commit
description: Stage and commit the current changes
disable-model-invocation: true
allowed-tools: Bash(git add *) Bash(git commit *) Bash(git status *)
---
```
Invoking `/commit` lets Claude run those exact git commands prompt-free; any other Bash command still hits your normal permission flow.

Argument pass-through:
```yaml
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.
1. Read the issue description
2. Understand the requirements
3. Implement the fix
4. Write tests
5. Create a commit
```
`/fix-issue 123` → Claude receives "Fix GitHub issue 123 following our coding standards…". If a skill lacked `$ARGUMENTS`, Claude Code would append `ARGUMENTS: 123` so the input still reaches Claude.

## Key Takeaways
1. `allowed-tools` grants prompt-free use of listed tools; it never restricts the pool.
2. Project `allowed-tools` activate only after accepting workspace trust — review skills before trusting.
3. `disallowed-tools` removes tools for one turn; clears on your next message.
4. For durable blocks across all skills/prompts, use permission deny rules, not frontmatter.
5. Args reach skills via `$ARGUMENTS`/`$N`; missing placeholders get an appended `ARGUMENTS:` line.

## Connects To
- **Ch 3**: both fields are part of the frontmatter reference.
- **Ch 4**: positional/named argument substitution details.
- **Ch 8**: restricting *which skills* Claude can invoke via `Skill(...)` permission rules.
