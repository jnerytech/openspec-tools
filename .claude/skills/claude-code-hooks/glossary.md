# Glossary — Claude Code Hooks

**additionalContext** — `UserPromptSubmit` output field; injects text into Claude's context as a plain-text system reminder (Ch 3).
**agent hook** — `type: "agent"`; spawns a subagent with tool access to verify against codebase state; 60 s / ≤50 turns; experimental (Ch 5).
**allowedEnvVars** — array on `http` hooks listing which `$VAR` references in headers get interpolated; others resolve empty (Ch 5).
**args (exec form)** — adding `"args": []` runs the script directly without a shell, avoiding quoting/profile issues (Ch 7).
**block cap** — Stop hook is overridden after blocking 8 consecutive times without progress; raise via `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (Ch 7).
**bypassPermissions** — permission mode; a `PreToolUse` hook `deny` still blocks within it (Ch 7).
**CLAUDE_ENV_FILE** — file Claude Code runs as a preamble before each Bash command; env-reload hooks write here (Ch 2).
**CLAUDE_PROJECT_DIR** — env var for referencing project-relative scripts safely in hook commands (Ch 6).
**command hook** — `type: "command"` (default); runs a shell command, communicates via stdin/stdout/stderr/exit code (Ch 1, 3).
**ConfigChange** — event firing when a config file changes; matcher = source (`user_settings`, `skills`, …) (Ch 1, 2).
**CwdChanged** — event firing when the working directory changes; no matcher (Ch 2).
**decision** — top-level output field (`"block"`) used by `PostToolUse` and `Stop` (Ch 3).
**defer** — `PreToolUse` permissionDecision available only in `-p` mode; preserves the call for an SDK to resume (Ch 3).
**deny / allow / ask** — `PreToolUse` permissionDecision values; deny cancels, allow skips prompt, ask prompts (Ch 3).
**disableAllHooks** — settings flag disabling hooks in that scope; managed hooks need it set in managed settings too (Ch 6).
**event** — named lifecycle point that fires hooks (e.g. `PreToolUse`, `Stop`) (Ch 1).
**FileChanged** — event for watched-file changes; matcher = literal filenames split on `|`, not regex (Ch 2, 4).
**http hook** — `type: "http"`; POSTs event JSON to a URL; block with a 2xx body (Ch 5).
**if (field)** — handler-level filter using permission-rule syntax (tool name + args); v2.1.85+; tool events only; fails open (Ch 4).
**jq** — CLI JSON parser used in most Bash recipes, e.g. `jq -r '.tool_input.file_path'` (Ch 2).
**matcher** — group-level filter on one event field (usually tool name); supports `|`/regex; case-sensitive (Ch 4).
**mcp_tool hook** — `type: "mcp_tool"`; calls a tool on a connected MCP server (Ch 5).
**MCP tool name** — `mcp__<server>__<tool>` naming convention; match with regex like `mcp__.*` (Ch 4).
**Notification** — event when Claude sends a notification; matcher = type (`idle_prompt`, `permission_prompt`, …) (Ch 1, 2).
**ok / reason** — response contract for prompt & agent hooks; `ok:false` effect varies by event (Ch 5).
**permissionDecision** — `PreToolUse` `hookSpecificOutput` field: allow/deny/ask/defer (Ch 3).
**PermissionRequest** — event when a permission dialog is about to show; decision via `hookSpecificOutput.decision.behavior`; doesn't fire in `-p` (Ch 2, 3, 7).
**PostToolUse** — event after a tool succeeds; can't undo (Ch 1, 7).
**PreToolUse** — event before a tool runs; can block; fires before permission-mode check (Ch 1, 3, 7).
**prompt hook** — `type: "prompt"`; single LLM call (Haiku default, `model` override) on input only; 30 s (Ch 5).
**SessionStart** — event when a session begins/resumes; stdout → context; matcher = source (`startup`, `compact`, …) (Ch 1, 2).
**stderr** — on exit 2 becomes Claude's feedback; otherwise → debug log + transcript notice (Ch 3).
**Stop** — event when Claude finishes responding; fires every turn, not on interrupts (Ch 1, 5, 7).
**stop_hook_active** — input flag on Stop hooks signaling a continuation is in progress; exit early to avoid loops (Ch 3, 7).
**structured JSON output** — exit 0 + a JSON object on stdout for fine-grained, event-specific control (Ch 3).
**type** — hook field selecting executor: command / http / mcp_tool / prompt / agent (Ch 1, 5).
**updatedInput** — `PreToolUse` output rewriting tool arguments; last parallel writer wins (Ch 3, 7).
**updatedPermissions / setMode** — `PermissionRequest` output to switch session permission mode (Ch 2).
