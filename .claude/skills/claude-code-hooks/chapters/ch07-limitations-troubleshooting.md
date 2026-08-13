# Chapter 7: Limitations & Troubleshooting

## Core Idea
Hooks have hard constraints (no `/` commands, can't undo `PostToolUse`, parallel non-determinism) and a small set of recurring failure modes — most fixable by checking registration, exit codes, paths, JSON validity, and shell-profile noise.

## Frameworks Introduced
- **Tighten-not-loosen rule**: `PreToolUse` hooks fire **before** any permission-mode check; a hook `deny` blocks even in `bypassPermissions` / `--dangerously-skip-permissions`. The reverse fails: `allow` never bypasses settings deny rules.
  - When to use: enforce policy users can't escape via permission mode.
  - How: return `permissionDecision: "deny"` from a `PreToolUse` hook.
- **Stop-hook block cap**: a Stop hook is overridden after blocking **8 times in a row** without progress.
  - When to use: any looping Stop hook.
  - How: read `stop_hook_active`; exit 0 early if true. Raise cap with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.

## Key Concepts
- **Limitations**: command hooks talk only via stdout/stderr/exit codes — can't trigger `/` commands or tool calls; `additionalContext` is injected as a plain-text system reminder. `PostToolUse` can't undo (tool already ran). `PermissionRequest` hooks don't fire in `-p` mode (use `PreToolUse`). `Stop` fires every time Claude finishes, not only at task completion, and not on user interrupts (API errors → `StopFailure`). Parallel `updatedInput` writers: last finisher wins, order non-deterministic — avoid multiple.
- **Debug log**: `claude --debug-file /tmp/claude.log` then `tail -f`; or `/debug` mid-session.
- **Transcript view (`Ctrl+O`)**: one line per fired hook; success silent, blocking shows stderr, non-blocking shows `<hook> hook error` + first stderr line.

## Mental Models
- Hooks **tighten, never loosen**: they can add restrictions on top of permissions but can't grant past a deny rule.
- A "valid JSON but rejected" error usually means **your shell profile printed text before your JSON** — not a bug in your hook.

## Anti-patterns
- **Unconditional `echo` in `~/.bashrc`/`~/.zshrc`**: its output prepends to hook JSON → parse failure. Guard with `if [[ $- == *i* ]]`.
- **Using `PermissionRequest` in `-p` mode**: never fires — switch to `PreToolUse`.
- **Multiple hooks rewriting one tool's `updatedInput`**: non-deterministic winner.

## Troubleshooting playbook
| Symptom | Checks / fix |
| --- | --- |
| Hook not firing | `/hooks` shows it? matcher exact (case-sensitive)? right event (Pre vs Post)? `PermissionRequest` in `-p`→use `PreToolUse` |
| "hook error" in transcript | script exited non-zero; test: `echo '{...}' \| ./hook.sh; echo $?`. "command not found"→absolute path / `${CLAUDE_PROJECT_DIR}` / `"args": []` exec form. "jq: not found"→install jq. not executable→`chmod +x` |
| `/hooks` shows none | edits auto-load; if not, restart. Validate JSON (no trailing commas/comments). Correct file location |
| Stop hook block cap hit | parse `stop_hook_active`, exit 0 if true; raise `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` |
| JSON validation failed | shell profile printed before JSON — guard echoes with `if [[ $- == *i* ]]` |

## Code Examples
Guard against Stop-hook infinite loop:
```bash
#!/bin/bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # already continued once — allow Claude to stop
fi
# ... rest of hook logic
```
Guard shell profile so it doesn't corrupt hook JSON:
```bash
# In ~/.zshrc or ~/.bashrc
if [[ $- == *i* ]]; then
  echo "Shell ready"   # only in interactive shells; hooks run non-interactive
fi
```
- **What they demonstrate**: the two most common "hook misbehaves" root causes — loop cap and profile noise.

## Worked Example
Diagnosing "my PreToolUse hook never blocks anything":
1. `/hooks` → is it listed under `PreToolUse`? If not → JSON invalid or wrong file (validate, restart).
2. Matcher right? `bash` ≠ `Bash` (case-sensitive). Fix to `Bash`.
3. Running in `-p`? `PermissionRequest` won't fire there — but `PreToolUse` does; confirm you used the right event.
4. Test the script directly: `echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh; echo $?` — expect exit 2 for a blocked case.
5. Still failing? `claude --debug-file /tmp/claude.log` + `tail -f` to see exit code, stdout, stderr per matched hook.

## Key Takeaways
1. Hooks tighten, never loosen — `deny` beats bypass mode; `allow` never beats deny rules.
2. `PostToolUse` can't undo; `PermissionRequest` dead in `-p` (use `PreToolUse`).
3. `Stop` fires every turn, not on interrupts; cap at 8 consecutive blocks (use `stop_hook_active`).
4. "command not found" → absolute path / `${CLAUDE_PROJECT_DIR}` / `chmod +x` / exec form.
5. JSON parse failures often = noisy shell profile; guard echoes with `[[ $- == *i* ]]`.
6. Debug with `--debug-file` + `tail -f`, or `/debug`; `Ctrl+O` transcript for per-hook summary.

## Connects To
- **Ch 3**: exit codes / JSON that these failures revolve around.
- **Ch 5**: prompt/agent Stop hooks subject to the same block cap.
- **Ch 6**: settings location/reload issues behind "no hooks configured."
