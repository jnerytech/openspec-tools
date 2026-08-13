# Chapter 12: Fork the Current Conversation

## Core Idea
A fork is a subagent that inherits the *entire* conversation so far instead of starting fresh. It drops the input isolation other subagents have — same system prompt, tools, model, and history as main — so you hand it a side task without re-explaining. Its tool calls stay out of your conversation; only its final result returns.

## Frameworks Introduced
- **Fork vs named subagent**: fork = full inherited context (cheap via shared prompt cache); named subagent = fresh context from its definition.
  - When to use a fork: a named subagent would need too much background to be useful, OR you want to try several approaches in parallel from the same starting point.
  - How: `/fork <directive>`, or Claude requests the `fork` subagent type.
- **Two changes fork mode makes**: (1) Claude can spawn a `fork` type explicitly (spawns without a type still use general-purpose; named agents like Explore unchanged); (2) every subagent spawn runs in the **background** (fork or named).

## Key Concepts
- **Version gates**: forks need v2.1.117+. From v2.1.161 `/fork` is on by default; earlier needs `CLAUDE_CODE_FORK_SUBAGENT=1`. Claude auto-spawning forks is experimental.
- **`CLAUDE_CODE_FORK_SUBAGENT`**: `1` enables, `0` disables (everywhere, incl. server rollout). Honored in interactive, SDK, `claude -p`.
- **Disable background**: `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` keeps spawns synchronous.
- **Prompt-cache win**: identical system prompt + tools → first request reuses the parent's prompt cache → cheaper than a fresh subagent for same-context tasks.
- **Worktree isolation**: Claude can pass `isolation: "worktree"` so the fork's edits go to a separate git worktree, not your checkout.
- **Cannot nest forks**: a fork cannot spawn another fork (but can spawn other types, which count toward the depth limit).

## Reference Tables
Fork vs named subagent:
| | Fork | Named subagent |
| --- | --- | --- |
| Context | Full conversation history | Fresh + the prompt you pass |
| System prompt & tools | Same as main | From definition file |
| Model | Same as main | From `model` field |
| Permissions | Prompts in your terminal | Prompts in main session (background) |
| Prompt cache | Shared with main | Separate cache |

Fork panel controls:
| Key | Action |
| --- | --- |
| `↑`/`↓` | Move between rows |
| `Enter` | Open fork transcript, send follow-ups |
| `x` | Dismiss finished / stop running fork |
| `Esc` | Return focus to prompt input |

## Code Examples
```text
/fork draft unit tests for the parser changes so far
```
- **What it demonstrates**: forks the conversation to draft tests while you keep implementing in main. Claude names the fork from the first words of the directive; it runs in the background and its result arrives as a message when done.

## Worked Example
Mid-implementation you want test cases drafted without losing your place:
1. Run `/fork draft unit tests for the parser changes so far`.
2. The fork spawns in a panel below the prompt, inheriting your full context (no re-explaining the parser changes), and runs in the background.
3. You keep coding in main. The fork's own tool calls never enter your conversation.
4. When it finishes, its drafted tests arrive as a single message. Because its prompt/tools matched main, the first request reused the parent prompt cache — cheaper than a fresh subagent.

## Anti-patterns
- **Forking when you need input isolation**: a fork sees everything — use a named subagent to keep context out.
- **Expecting a fork to spawn another fork**: not allowed.
- **Assuming `/fork` works on old versions**: needs v2.1.117+ (and the env var before v2.1.161).

## Key Takeaways
1. Fork inherits full context (prompt, tools, model, history); only its result returns.
2. Use forks to skip re-explaining, or to try parallel approaches from one start.
3. Shared prompt cache makes forks cheaper than fresh subagents for same-context work.
4. Fork mode forces all spawns to background; `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` reverts.
5. Forks can't nest forks; `isolation: "worktree"` isolates their file edits.

## Connects To
- **Ch 11**: forks are the exception to "fresh context at startup".
- **Ch 10**: forks avoid the subagent fresh-start latency cost.
- **Ch 3**: `isolation: worktree` field.
