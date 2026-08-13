---
name: claude-code-hooks
description: "Knowledge base from \"Automate actions with hooks\" (Claude Code docs). Use when authoring or debugging Claude Code hooks — hook events & lifecycle, matchers and the if field, exit-code vs structured-JSON decision control, command/http/prompt/agent hook types, settings scope, and troubleshooting."
---

<!-- argument-hint: [event name, hook type, matcher, or chapter number] -->

# Automate Actions with Hooks
**Source**: Claude Code docs — code.claude.com/docs/en/hooks-guide | **Sections**: 7 | **Generated**: 2026-06-23

## How to Use This Skill

- **Without arguments** — load core frameworks for reference
- **With a topic** — ask about `PreToolUse`, `matchers`, `exit codes`, `agent hooks`; I find and read the relevant chapter
- **With chapter** — ask for `ch03`; I load that specific chapter
- **Browse** — ask "what chapters do you have?" for the full index

When you ask about a topic not covered below, I read the relevant chapter file before answering.

---

## Core Frameworks & Mental Models

**What a hook is.** A user-defined shell command (or `http`/`prompt`/`agent` call) that fires at a lifecycle **event**, giving *deterministic* control — the action always happens; the model can't skip it. Use for rules the LLM "should" follow but you need guaranteed.

**Config shape (memorize).** Always `Event → group(matcher) → handlers(type, command)`:
```json
{ "hooks": { "<Event>": [ { "matcher": "...", "hooks": [ { "type": "command", "command": "..." } ] } ] } }
```
Matching hooks fire **in parallel**; identical commands deduped. `/hooks` browses them (read-only); edit settings JSON to change.

**Deterministic → judgment ladder (pick the lowest rung that works):**
- `command` — shell, exit-code/JSON decision (default). `http` — POST event JSON to a URL (offload logic).
- `prompt` — single LLM call (Haiku, 30 s) when **input alone** decides.
- `agent` — subagent with tools (60 s, ≤50 turns, *experimental*) when you must **inspect codebase state**.

**Decide the action — two protocols:**
- **Exit codes**: `0` = proceed (stdout→context on SessionStart/UserPromptSubmit), `2` = block (stderr = Claude's feedback), other = error.
- **Structured JSON** (`exit 0` + one object on stdout): richer control. *Never mix with exit 2.* Decision field **varies by event** — `PreToolUse`→`permissionDecision` (allow/deny/ask/defer); `PostToolUse`/`Stop`→`decision:"block"`; `PermissionRequest`→`decision.behavior`; `UserPromptSubmit`→`additionalContext`. prompt/agent use `{"ok","reason"}`.

**Merge rule.** Many hooks on one event → most-restrictive wins: **deny > defer > ask > allow**; all `additionalContext` kept. Siblings run to completion — a deny doesn't undo another hook's side effects.

**Tighten, never loosen.** `PreToolUse` fires *before* the permission-mode check, so a hook `deny` blocks even under `bypassPermissions`/`--dangerously-skip-permissions`. But `allow` never overrides settings deny rules. Put unbypassable policy in **managed settings**.

**Filtering.** `matcher` = group-level, one field (usually tool name), supports `Edit|Write`/`mcp__.*` (case-sensitive); `FileChanged` matcher is *literal filenames* split on `|`. `if` = handler-level, name **+ args** via permission-rule syntax (`Bash(git *)`, v2.1.85+, tool events only) — best-effort, **fails open**, not a security boundary.

**Scope = file location.** `~/.claude/settings.json` (all projects) · `.claude/settings.json` (project, committable) · `.claude/settings.local.json` (private) · managed policy (org, unbypassable) · plugin/skill/agent (component-bundled). `disableAllHooks` turns off per scope; managed needs it set in managed too.

**Top gotchas.** `PostToolUse` can't undo. `PermissionRequest` doesn't fire in `-p` (use `PreToolUse`). `Stop` fires every turn (not on interrupt) and self-overrides after **8** consecutive blocks (guard with `stop_hook_active`). "JSON validation failed" despite valid output = noisy shell profile → guard echoes with `if [[ $- == *i* ]]`.

---

## Chapter Index

| # | Title | Key Frameworks |
|---|-------|----------------|
| [ch01](chapters/ch01-fundamentals-lifecycle.md) | Fundamentals & Lifecycle | deterministic control, event→matcher→handler, parallel+dedup, event table |
| [ch02](chapters/ch02-recipes.md) | Common Recipes | 7 patterns: notify, format, protect, re-inject, audit, env reload, auto-approve |
| [ch03](chapters/ch03-io-exit-codes-decisions.md) | Input, Output & Decisions | stdin JSON, exit codes, structured JSON, most-restrictive merge |
| [ch04](chapters/ch04-matchers-if-field.md) | Matchers & `if` Field | group matcher, `if` (name+args), MCP naming, fails-open |
| [ch05](chapters/ch05-hook-types.md) | Hook Types | command/http/prompt/agent, `ok`/`reason`, judgment ladder |
| [ch06](chapters/ch06-configuration-scope.md) | Configuration & Scope | scope-by-location, managed policy, `disableAllHooks`, component hooks |
| [ch07](chapters/ch07-limitations-troubleshooting.md) | Limitations & Troubleshooting | tighten-not-loosen, block cap, debug log, playbook |

## Topic Index

- **additionalContext** → ch03
- **agent hook** → ch05
- **audit / logging** → ch02, ch03
- **auto-approve permission** → ch02, ch03
- **block a tool call** → ch02, ch03
- **CLAUDE_ENV_FILE / env reload** → ch02
- **command hook** → ch01, ch03
- **ConfigChange** → ch01, ch02
- **CwdChanged / FileChanged** → ch02, ch04
- **debug / debug log** → ch07
- **decision control / permissionDecision** → ch03
- **disableAllHooks** → ch06
- **events (lifecycle table)** → ch01
- **exit codes** → ch03
- **formatting (prettier)** → ch02
- **http hook** → ch05
- **if field** → ch04
- **jq field extraction** → ch02, ch03
- **managed policy / unbypassable** → ch06, ch07
- **matchers** → ch04
- **MCP tool hooks / naming** → ch04, ch05
- **Notification** → ch01, ch02
- **PermissionRequest** → ch02, ch03, ch07
- **PostToolUse** → ch01, ch07
- **PreToolUse** → ch01, ch03, ch07
- **prompt hook** → ch05
- **scope / settings location** → ch06
- **SessionStart / context injection** → ch01, ch02
- **Stop hook / block cap / stop_hook_active** → ch01, ch05, ch07
- **structured JSON output** → ch03
- **timeouts** → ch01, ch05
- **troubleshooting playbook** → ch07
- **types (type field)** → ch01, ch05

## Supporting Files

- [glossary.md](glossary.md) — all key terms with definitions
- [patterns.md](patterns.md) — 11 concrete hook patterns (when/how/trade-offs)
- [cheatsheet.md](cheatsheet.md) — decision rules, tables, defaults, smells

---

## Scope & Limits

Covers the "Automate actions with hooks" guide only. For full event schemas, JSON I/O formats, async/MCP-tool hooks, and per-event exit-2 behavior, see the [Hooks reference](https://code.claude.com/docs/en/hooks). For sharing extensions, see [plugins](https://code.claude.com/docs/en/plugins); for permission rules referenced by `if`, see [permissions](https://code.claude.com/docs/en/permissions). Review [security considerations](https://code.claude.com/docs/en/hooks#security-considerations) before deploying hooks in shared/production environments.
