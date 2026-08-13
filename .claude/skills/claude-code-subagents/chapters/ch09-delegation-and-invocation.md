# Chapter 9: Delegation & Explicit Invocation

## Core Idea
Claude auto-delegates based on task + the `description` field + context. When auto-delegation isn't enough, three patterns escalate from a one-off suggestion to a session-wide default: natural language → @-mention → `--agent`/`agent` setting.

## Frameworks Introduced
- **The invocation escalation ladder**:
  1. **Natural language**: name the subagent; Claude decides whether to delegate.
  2. **@-mention**: guarantees that subagent runs for one task.
  3. **Session-wide** (`--agent` flag or `agent` setting): the whole session uses that subagent's system prompt, tools, and model.
  - When to use: escalate only as far as you need control.
- **Proactive-delegation trick**: include "use proactively" in the `description` to encourage Claude to delegate automatically.

## Key Concepts
- **@-mention controls *which* agent, not the prompt**: your full message still goes to Claude, which writes the subagent's task prompt. Type `@` and pick from typeahead, or manually `@agent-<name>` (local) / `@agent-<plugin>:<name>` (plugin).
- **`--agent <name>`**: the main thread *becomes* that subagent — its system prompt replaces the default Claude Code system prompt entirely (like `--system-prompt`). CLAUDE.md/project memory still load. Name shows as `@<name>` in the startup header. Persists across resume.
- **`agent` setting** in `.claude/settings.json` makes it the project default; the CLI flag overrides the setting.
- **Plugin disambiguation**: pass scoped name (`my-plugin:security-reviewer`, or `my-plugin:review:security` for subfolders) when names collide.

## Code Examples
Natural language:
```text
Use the test-runner subagent to fix failing tests
Have the code-reviewer subagent look at my recent changes
```
@-mention:
```text
@"code-reviewer (agent)" look at the auth changes
```
Run whole session as a subagent:
```shellscript
claude --agent code-reviewer
```
Project default (`.claude/settings.json`):
```json
{ "agent": "code-reviewer" }
```

## Reference Tables
| Pattern | Guarantee | Scope |
| --- | --- | --- |
| Natural language | Claude decides | One task (maybe) |
| @-mention | This agent runs | One task |
| `--agent` flag | Becomes main thread | Whole session |
| `agent` setting | Project default | Every session (flag overrides) |

## Worked Example
You want every session in a repo to behave as a strict code-reviewer:
1. Add `{ "agent": "code-reviewer" }` to `.claude/settings.json` → default for all sessions.
2. For a one-off override elsewhere, launch `claude --agent debugger` (flag beats setting).
3. The header shows `@code-reviewer` so you can confirm it's active; the choice persists when you resume.

## Anti-patterns
- **Expecting @-mention to set the subagent's prompt**: it only picks which agent; Claude still authors the task prompt.
- **Vague `description`**: weakens auto-delegation. Be specific; add "use proactively" for eager delegation.

## Key Takeaways
1. Auto-delegation keys off task + `description` + context.
2. Escalate: natural language → @-mention (guaranteed) → `--agent`/setting (session-wide).
3. `--agent` replaces the default system prompt entirely; CLAUDE.md still loads.
4. CLI flag overrides the `agent` setting.
5. "use proactively" in `description` boosts auto-delegation.

## Connects To
- **Ch 2**: scoped plugin names appear in the typeahead.
- **Ch 8**: frontmatter hooks fire when run as main session too.
- **Ch 10**: when to delegate vs stay in main conversation.
