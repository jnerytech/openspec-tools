# Chapter 2: Common Hook Recipes

## Core Idea
Seven ready-to-use hook patterns covering the most common automations: notifications, formatting, file protection, context re-injection, audit logging, environment reload, and auto-approval.

## Frameworks Introduced
- **Recipe = event + matcher + action**: each automation picks the right event, narrows with a matcher, and runs a small command (often `jq` to extract a field).
  - When to use: copy the closest recipe, then adjust matcher/command.
  - How: paste the JSON into the correct settings file (ch06), install `jq` if the command uses it.

## Key Concepts
- **`jq` field extraction**: most Bash recipes parse stdin JSON, e.g. `jq -r '.tool_input.file_path'`. Install: `brew install jq` / `apt-get install jq`.
- **stdout → context**: for `SessionStart`/`UserPromptSubmit`, anything printed to stdout is injected into Claude's context.
- **exit 2 → block**: a script exiting 2 blocks the action (ch03).
- **JSON decision → control**: `PermissionRequest` auto-approval requires JSON on stdout, not an exit code.

## The 7 Recipes

### 1. Notify when Claude needs input — `Notification`
macOS `osascript`, Linux `notify-send`, Windows PowerShell MessageBox. Empty matcher = all types; or scope to `idle_prompt` / `permission_prompt`. (macOS: grant Script Editor notification permission once or it fails silently.)

### 2. Auto-format after edits — `PostToolUse` + `Edit|Write`
```json
{ "hooks": { "PostToolUse": [ { "matcher": "Edit|Write",
  "hooks": [ { "type": "command",
    "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write" } ] } ] } }
```
Put in project `.claude/settings.json`. Matcher limits to file-editing tools.

### 3. Block edits to protected files — `PreToolUse`
Call a script that checks the target path against protected patterns (`.env`, `package-lock.json`, `.git/`) and **exits 2** to block. Claude gets the stderr as feedback and adjusts.

### 4. Re-inject context after compaction — `SessionStart` + `compact`
```json
{ "hooks": { "SessionStart": [ { "matcher": "compact",
  "hooks": [ { "type": "command",
    "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing.'" } ] } ] } }
```
stdout is added to context. Replace `echo` with dynamic output like `git log --oneline -5`. (For every-session context, prefer CLAUDE.md.)

### 5. Audit configuration changes — `ConfigChange`
```json
{ "hooks": { "ConfigChange": [ { "matcher": "",
  "hooks": [ { "type": "command",
    "command": "jq -c '{timestamp: now|todate, source: .source, file: .file_path}' >> ~/claude-config-audit.log" } ] } ] } }
```
Matcher filters by type: `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills`. Exit 2 or `{"decision":"block"}` to block the change.

### 6. Reload environment on dir/file change — `SessionStart` + `CwdChanged` (or `FileChanged`)
Both write to `$CLAUDE_ENV_FILE`, which Claude Code runs as a preamble before each Bash command:
```json
{ "hooks": {
  "SessionStart": [ { "hooks": [ { "type": "command", "command": "direnv export bash > \"$CLAUDE_ENV_FILE\"" } ] } ],
  "CwdChanged":   [ { "hooks": [ { "type": "command", "command": "direnv export bash > \"$CLAUDE_ENV_FILE\"" } ] } ] } }
```
Run `direnv allow` once per dir. `FileChanged` with `"matcher": ".envrc|.env"` reacts to specific files instead of every dir change (matcher = literal filenames split on `|`, not regex).

### 7. Auto-approve a permission prompt — `PermissionRequest` + `ExitPlanMode`
```json
{ "hooks": { "PermissionRequest": [ { "matcher": "ExitPlanMode",
  "hooks": [ { "type": "command",
    "command": "echo '{\"hookSpecificOutput\": {\"hookEventName\": \"PermissionRequest\", \"decision\": {\"behavior\": \"allow\"}}}'" } ] } ] } }
```
Requires JSON on stdout (not exit code). Keep matcher **narrow** — empty/`.*` auto-approves *everything* including writes and shell commands.

## Anti-patterns
- **Broad `PermissionRequest` matcher**: auto-approving all prompts defeats the permission system. Scope it.
- **`SessionStart` for static context**: use CLAUDE.md instead of an `echo` hook for always-on reminders.
- **Forgetting `direnv allow`**: env reload silently does nothing until the dir is permitted.

## Worked Example
Protecting `.env` (recipe 3), the full script the hook calls:
```bash
#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path')
case "$FILE" in
  *.env|*package-lock.json|*/.git/*)
    echo "Blocked: $FILE is protected" >&2   # stderr → Claude's feedback
    exit 2 ;;                                  # exit 2 → block
esac
exit 0
```
Wire it: `PreToolUse` group, `"matcher": "Edit|Write"`, `"command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect.sh"`. Claude sees "Blocked: …/.env is protected" and chooses a different path.

## Key Takeaways
1. Pick the event that matches *when* you want to act; narrow with a matcher.
2. `jq -r '.tool_input.<field>'` is the workhorse for reading stdin JSON.
3. `SessionStart`/`UserPromptSubmit` inject stdout into context.
4. Blocking = exit 2 + stderr reason; auto-approval = JSON on stdout.
5. Keep `PermissionRequest` matchers as narrow as possible.
6. `$CLAUDE_ENV_FILE` is the channel for env vars into the Bash tool.

## Connects To
- **Ch 3**: exit codes vs. JSON output that these recipes rely on.
- **Ch 4**: matcher syntax (`Edit|Write`, literal filenames, `mcp__.*`).
- **Ch 6**: which settings file each recipe belongs in.
