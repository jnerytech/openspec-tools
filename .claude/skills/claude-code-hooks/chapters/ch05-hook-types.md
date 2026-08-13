# Chapter 5: Hook Types — command, http, prompt, agent

## Core Idea
Beyond shell `command` hooks, three other types let you POST to a server (`http`), or delegate the decision to a Claude model — single-turn (`prompt`) or multi-turn with tools (`agent`) — for judgment that deterministic rules can't express.

## Frameworks Introduced
- **Deterministic → judgment ladder**: `command`/`http` (rules) → `prompt` (single LLM call, input-only) → `agent` (subagent that inspects the codebase).
  - When to use: climb only as far as the decision needs.
  - How: set `"type"` accordingly; prompt/agent take a `prompt` field.
- **`ok`/`reason` response (prompt & agent)**: the model returns `{"ok": true}` to proceed or `{"ok": false, "reason": "..."}`; effect of false depends on the event.
  - When to use: any prompt/agent hook.
  - How: the model's only job is to emit that JSON.

## Key Concepts
- **`prompt` hook**: Claude Code sends your prompt + hook input to a model (**Haiku by default**; override with `model`). Single-turn, **input data only**. Timeout 30 s.
- **`agent` hook** (experimental): spawns a subagent that can read files, search, run commands. Default timeout **60 s**, up to **50 tool-use turns**. `$ARGUMENTS` available in the prompt.
- **`http` hook**: POSTs the same stdin JSON to a `url`; response body uses the same output format. Block via a **2xx** response with `hookSpecificOutput` (HTTP status alone can't block).
- **`mcp_tool` hook**: calls a tool on an already-connected MCP server.
- **`allowedEnvVars`**: array gating which `$VAR` references in `http` headers are interpolated; others resolve empty.

## `ok: false` effect by event
- **`Stop` / `SubagentStop`**: `reason` fed back → Claude keeps working.
- **`PreToolUse`**: tool call denied, `reason` returned as the tool error.
- **`PostToolUse` / `PostToolBatch` / `UserPromptSubmit` / `UserPromptExpansion`**: turn ends, `reason` shown as a chat warning line.

## Mental Models
- **`prompt` when input alone decides; `agent` when you must check actual codebase state.** (Don't pay agent cost for an input-only check.)
- `http` = move hook logic off-box: a shared team audit/policy service receiving every event.
- Agent hooks are **experimental** — prefer command hooks for production-critical paths.

## Anti-patterns
- **Agent hook for a trivial check**: wasteful (60 s, 50 turns). Use `prompt` or `command`.
- **Relying on HTTP status to block**: must return a 2xx body with decision fields, not a 4xx/5xx.
- **Unscoped env in http headers**: forgetting `allowedEnvVars` leaves `$TOKEN` empty.

## Code Examples
`prompt` Stop hook — keep working until tasks done:
```json
{ "hooks": { "Stop": [ { "hooks": [ { "type": "prompt",
  "prompt": "Check if all tasks are complete. If not, respond with {\"ok\": false, \"reason\": \"what remains to be done\"}." } ] } ] } }
```
`agent` Stop hook — verify tests pass (inspects codebase):
```json
{ "hooks": { "Stop": [ { "hooks": [ { "type": "agent",
  "prompt": "Verify that all unit tests pass. Run the test suite and check the results. $ARGUMENTS",
  "timeout": 120 } ] } ] } }
```
`http` PostToolUse hook — POST every tool use to a service:
```json
{ "hooks": { "PostToolUse": [ { "hooks": [ { "type": "http",
  "url": "http://localhost:8080/hooks/tool-use",
  "headers": { "Authorization": "Bearer $MY_TOKEN" },
  "allowedEnvVars": ["MY_TOKEN"] } ] } ] } }
```
- **What they demonstrate**: same `ok`/`reason` contract for prompt/agent; http externalizes logic with gated env interpolation.

## Reference Tables
| Type | Decision basis | Timeout | Tools? | Notes |
| --- | --- | --- | --- | --- |
| `command` | exit code / JSON | 10 min | shell | default; ch03 protocol |
| `http` | response body JSON | 10 min | external | 2xx body blocks; `allowedEnvVars` |
| `mcp_tool` | MCP tool result | 10 min | one MCP tool | connected server only |
| `prompt` | `ok`/`reason` | 30 s | none (input only) | Haiku default, `model` to override |
| `agent` | `ok`/`reason` | 60 s | read/search/run, ≤50 turns | **experimental** |

## Worked Example
Choosing between prompt and agent for "don't stop until done":
- **Question A — "did the model claim all todos complete?"** The answer is in the conversation/input → use a **`prompt`** Stop hook (first example). Cheap, 30 s.
- **Question B — "do the tests actually pass?"** Can't be known from input; must run the suite → use an **`agent`** Stop hook (second example), raise `timeout` to 120 s for a slow suite.
- Both return `{"ok": false, "reason": "..."}`; on `Stop`, the `reason` becomes Claude's next instruction and it resumes work (watch the block cap, ch07).

## Key Takeaways
1. Climb the ladder only as far as needed: command/http → prompt → agent.
2. prompt = single LLM call on input only (Haiku default, `model` override, 30 s).
3. agent = subagent with tools, 60 s / 50 turns, experimental.
4. prompt & agent share the `{"ok", "reason"}` contract; `ok:false` effect varies by event.
5. http externalizes logic; block with a 2xx body, gate env with `allowedEnvVars`.
6. Prefer command hooks for production-critical enforcement.

## Connects To
- **Ch 1**: type table and timeouts overview.
- **Ch 3**: command-hook exit/JSON protocol (different from `ok`/`reason`).
- **Ch 7**: Stop-hook block cap that prompt/agent Stop hooks can hit.
