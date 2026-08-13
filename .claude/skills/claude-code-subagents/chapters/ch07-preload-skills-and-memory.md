# Chapter 7: Preload Skills & Persistent Memory

## Core Idea
`skills` injects full skill content into a subagent's context at startup (domain knowledge without runtime discovery). `memory` gives the subagent a persistent directory that survives across conversations, enabling cross-session learning.

## Frameworks Introduced
- **Preload vs invoke distinction**: `skills` controls which skills are *preloaded* (full content injected), NOT which the subagent *can access*. Without it, the subagent can still discover and invoke project/user/plugin skills via the Skill tool. To block invocation entirely, omit `Skill` from `tools` or add it to `disallowedTools`.
- **Memory scope choice**: `project` is the recommended default (shareable via version control). `user` for cross-project knowledge; `local` for project-specific but not version-controlled.

## Key Concepts
- **Cannot preload `disable-model-invocation: true` skills**: preloading draws from the same set Claude can invoke. Missing/disabled skill → skipped, warning logged to debug log.
- **skills vs `context: fork`**: inverse mechanisms on the same system. `skills` in a subagent → subagent owns the system prompt and loads skill content. `context: fork` in a skill → skill content injected into the agent you specify.
- **Memory auto-enables Read/Write/Edit** so the subagent can manage its files.

## Reference Tables
Memory scopes:
| Scope | Location | Use when |
| --- | --- | --- |
| `user` | `~/.claude/agent-memory/<name>/` | remember across all projects |
| `project` | `.claude/agent-memory/<name>/` | project-specific + shareable via VCS |
| `local` | `.claude/agent-memory-local/<name>/` | project-specific, NOT in VCS |

When memory is enabled:
- System prompt gains read/write instructions for the memory directory.
- System prompt includes first **200 lines or 25KB** of `MEMORY.md` (whichever comes first), with instructions to curate if over the limit.
- Read, Write, Edit auto-enabled.

## Code Examples
Preload skills:
```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---

Implement API endpoints. Follow the conventions and patterns from the preloaded skills.
```
Enable memory + instruct upkeep:
```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices
memory: user
---

You are a code reviewer. As you review code, update your agent memory with
patterns, conventions, and recurring issues you discover.
```

## Worked Example
Building a code-reviewer that gets smarter over time:
1. Set `memory: project` (so the team shares the learnings via git).
2. In the body, add: *"Update your agent memory as you discover codepaths, patterns, library locations, and key architectural decisions. Write concise notes about what you found and where."*
3. When delegating: *"Review this PR, and check your memory for patterns you've seen before."*
4. After: *"Now that you're done, save what you learned to your memory."*
Over several PRs `MEMORY.md` accumulates institutional knowledge that's auto-injected (first 200 lines / 25KB) on each future run.

## Anti-patterns
- **Using `skills` to grant access**: it only preloads; access is governed by the Skill tool / `tools` list.
- **Letting `MEMORY.md` grow unbounded**: only the first 200 lines / 25KB loads — curate it.
- **Preloading a `disable-model-invocation` skill**: silently skipped (debug-log warning only).

## Key Takeaways
1. `skills` injects full content at startup; it's preload, not access control.
2. Block skill invocation by removing `Skill` from tools / adding to `disallowedTools`.
3. `memory` persists across conversations; `project` scope is the recommended default.
4. Memory injects the first 200 lines / 25KB of `MEMORY.md` and auto-enables Read/Write/Edit.
5. Instruct memory upkeep in the body so the subagent self-maintains its knowledge base.

## Connects To
- **Ch 3**: `skills` and `memory` frontmatter fields.
- **Ch 11**: preloaded skills are part of "what loads at startup".
- **Ch 5**: `tools`/`disallowedTools` gate the Skill tool.
