# Chapter 10: Common Patterns & Subagent vs Main Conversation

## Core Idea
Subagents shine at isolating verbose work, parallel research, and chained workflows. But they start fresh (latency, context-gathering cost), so prefer the main conversation for iterative, shared-context, or quick work.

## Frameworks Introduced
- **Three core patterns**:
  - **Isolate high-volume operations**: delegate test runs, doc fetches, log processing — verbose output stays in the subagent; only the summary returns.
  - **Parallel research**: spawn multiple subagents for independent investigations; Claude synthesizes. Best when paths don't depend on each other.
  - **Chain subagents**: sequence them; each returns results that Claude passes to the next.
- **Subagent-vs-main decision rule**: choose by context-sharing need + output volume + latency tolerance (see table).

## Mental Models
- Think of a subagent as a "sealed worker": great for self-contained jobs that return a summary; poor for tight back-and-forth.
- Many subagents each returning detailed results can themselves bloat main context — summaries, not dumps.
- For sustained parallelism beyond your context window, use **agent teams** (each worker has its own context), not many subagents.

## Reference Tables
| Use MAIN conversation when | Use SUBAGENTS when |
| --- | --- |
| Frequent back-and-forth / iterative refinement | Task produces verbose output you don't need |
| Multiple phases share significant context | You want tool/permission restrictions enforced |
| Quick, targeted change | Work is self-contained, returns a summary |
| Latency matters (subagents start fresh) | — |

Alternatives to reach for:
| Want | Use instead |
| --- | --- |
| Reusable prompt/workflow in MAIN context | **Skills** |
| Quick question about current conversation | **`/btw`** (full context, no tools, answer discarded) |
| Sustained parallelism beyond context window | **Agent teams** |

## Code Examples
Isolate output:
```text
Use a subagent to run the test suite and report only the failing tests with their error messages
```
Parallel research:
```text
Research the authentication, database, and API modules in parallel using separate subagents
```
Chain:
```text
Use the code-reviewer subagent to find performance issues, then use the optimizer subagent to fix them
```

## Worked Example
A noisy test suite floods context every run. Instead of running it inline, delegate: *"Use a subagent to run the test suite and report only the failing tests with their error messages."* The thousands of lines of pass/fail output live in the subagent's context; your main conversation receives only the short failure summary — preserving budget for the actual fix work.

## Anti-patterns
- **Delegating an iterative, context-heavy task**: the subagent starts fresh and must re-gather context — slower, and you lose the shared thread.
- **Spawning many detail-returning subagents**: their combined summaries can still blow main context. Ask for terse summaries or use agent teams.
- **Using a subagent for a quick question already in context**: use `/btw` instead (no tool overhead, answer discarded).

## Key Takeaways
1. Best subagent uses: isolate verbose output, parallel independent research, sequential chains.
2. Stay in main for iterative, shared-context, quick, or latency-sensitive work.
3. Subagents start fresh — context-gathering and latency are real costs.
4. Skills = reusable workflow in main context; `/btw` = quick contextual question.
5. Agent teams beat many-subagents for sustained parallelism past your context window.

## Connects To
- **Ch 11**: subagents start fresh — "what loads at startup".
- **Ch 9**: how to trigger these patterns via prompts.
- **Ch 12**: forks avoid the fresh-start cost by inheriting context.
