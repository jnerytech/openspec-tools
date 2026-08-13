# Patterns — Claude Code Hooks

## Block a dangerous tool call
**When to use**: prevent specific commands/edits deterministically (e.g. `drop table`, `rm -rf`, protected files).
**How**: `PreToolUse` hook → script reads stdin, matches `tool_input`, writes reason to stderr, `exit 2`.
**Trade-offs**: hard block, simple; no extra fields. For richer control use JSON deny. Siblings still run — deny doesn't roll back their side effects.

## Structured deny with reason
**When to use**: deny and explain to Claude so it self-corrects, without exit 2.
**How**: `exit 0` + `{"hookSpecificOutput": {"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`.
**Trade-offs**: more expressive (allow/ask/defer, mode set, input rewrite) but must not mix with exit 2 (JSON ignored).

## Auto-format on edit
**When to use**: keep formatting consistent without manual runs.
**How**: `PostToolUse` + `matcher:"Edit|Write"` → `jq -r '.tool_input.file_path' | xargs npx prettier --write`.
**Trade-offs**: runs after every edit; can't undo. Needs `jq` + formatter installed.

## Inject context (session / after compaction)
**When to use**: remind Claude of conventions or recent work, especially after compaction loses detail.
**How**: `SessionStart` (matcher `compact` for post-compaction) → command whose stdout = the context (`echo`, `git log --oneline -5`).
**Trade-offs**: for always-on context prefer CLAUDE.md; hook is best for dynamic output.

## Auto-approve a narrow permission prompt
**When to use**: skip the dialog for a tool you always allow (e.g. `ExitPlanMode`).
**How**: `PermissionRequest` + narrow matcher → JSON on stdout with `decision.behavior:"allow"` (optionally `updatedPermissions`/`setMode`).
**Trade-offs**: requires JSON (not exit code); broad matcher auto-approves everything — dangerous. Can't clear context like the dialog can.

## Audit / log every event
**When to use**: compliance, debugging, team telemetry.
**How**: `PostToolUse`/`PreToolUse`/`ConfigChange` → `jq` extract + `>>` to a log file; or `type:"http"` to a shared service.
**Trade-offs**: pure side effect (exit 0, no decision). HTTP centralizes but adds a network dependency.

## Reactive environment reload
**When to use**: per-directory env vars (direnv/devbox/nix) that the Bash tool wouldn't otherwise pick up.
**How**: `SessionStart` + `CwdChanged` (or `FileChanged` matcher `.envrc|.env`) → `direnv export bash > "$CLAUDE_ENV_FILE"`.
**Trade-offs**: needs `direnv allow` per dir; `CwdChanged` fires on every dir change, `FileChanged` is more targeted.

## Don't-stop-until-done (LLM judgment)
**When to use**: keep Claude working until a condition holds.
**How**: `Stop` `type:"prompt"` (input-only check) or `type:"agent"` (verify codebase, e.g. run tests). Return `{"ok":false,"reason":"..."}` to continue.
**Trade-offs**: prompt is cheap (30 s, input only); agent is powerful but slow (60 s, ≤50 turns, experimental). Subject to the 8-block cap — guard with `stop_hook_active`.

## Tamper-proof policy (can't be bypassed)
**When to use**: enforce rules users must not disable.
**How**: `PreToolUse` `deny` (fires before permission-mode check, beats bypass) placed in **managed policy settings**; set `disableAllHooks` in managed too.
**Trade-offs**: strongest enforcement; admin-controlled, not user-editable. Hooks tighten only — can't grant past a deny rule.

## Filter by command + args (cost control)
**When to use**: run an expensive hook only for matching calls (e.g. git commands, not all Bash).
**How**: handler `if:"Bash(git *)"` inside a `matcher:"Bash"` group; process spawns only on match. v2.1.85+.
**Trade-offs**: best-effort, fails open — not a security boundary; use permission rules for hard enforcement.
