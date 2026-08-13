# Chapter 6: Scope MCP Servers & Permission Modes

## Core Idea
`mcpServers` gives a subagent MCP access the main conversation lacks — and can keep an MCP server *out* of main entirely to save context. `permissionMode` controls how the subagent handles permission prompts, but several parent modes take precedence and can't be overridden.

## Frameworks Introduced
- **Inline vs reference MCP servers**:
  - Inline definition (full config under the server name): scoped to this subagent only; connected at subagent start, disconnected at finish.
  - String reference (e.g. `github`): shares the parent session's existing connection.
  - When to use inline: to hide an MCP server's tool descriptions from the main conversation (saves context there).
- **Permission-mode precedence rule**: parent `bypassPermissions` or `acceptEdits` takes precedence and cannot be overridden. Parent `auto` mode → subagent inherits auto; its frontmatter `permissionMode` is ignored.

## Key Concepts
- **mcpServers applies in two contexts**: (1) as a spawned subagent, (2) as the main session via `--agent`/`agent` setting. When main, inline defs connect at startup alongside `.mcp.json` and settings servers.
- **Inline schema**: same as `.mcp.json` entries — `stdio`, `http`, `sse`, `ws`, keyed by server name.
- **Managed restrictions cover frontmatter MCP** (v2.1.153+): `--strict-mcp-config`, `--bare`, enterprise managed MCP, `allowedMcpServers`/`deniedMcpServers`. Blocked → skipped with a warning naming them.
- **Caller-input exception**: `--strict-mcp-config` does NOT filter servers passed inline via `--agents` or the SDK `agents` option (explicit caller input).

## Code Examples
```yaml
---
name: browser-tester
description: Tests features in a real browser using Playwright
mcpServers:
  # Inline definition: scoped to this subagent only
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
  # Reference by name: reuses an already-configured server
  - github
---

Use the Playwright tools to navigate, screenshot, and interact with pages.
```
- **What it demonstrates**: mixing an inline (subagent-only) server with a by-name reference to a shared one.

## Reference Tables
Permission modes:
| Mode | Behavior |
| --- | --- |
| `default` | Standard prompts |
| `acceptEdits` | Auto-accept edits + common FS cmds in working dir/`additionalDirectories` |
| `auto` | Background classifier reviews commands + protected-dir writes |
| `dontAsk` | Auto-deny prompts (explicitly allowed tools still work) |
| `bypassPermissions` | Skip prompts entirely |
| `plan` | Plan mode (read-only exploration) |

Parent → child precedence:
| Parent mode | Effect on subagent |
| --- | --- |
| `bypassPermissions` | Forced; child cannot override |
| `acceptEdits` | Forced; child cannot override |
| `auto` | Child inherits auto; its `permissionMode` ignored |
| others | Child may override |

## Anti-patterns
- **Defining a context-heavy MCP server in `.mcp.json` when only one subagent needs it**: bloats main context with tool descriptions. Define inline in that subagent instead.
- **`bypassPermissions` casually**: it skips prompts and allows writes to `.git`, `.claude`, `.vscode`, `.idea`, `.husky`, `.cargo`, etc. Only `ask` rules and root/home removals (`rm -rf /`) still prompt.
- **Assuming child `permissionMode` always wins**: parent bypass/acceptEdits/auto override it.

## Key Takeaways
1. Inline MCP = subagent-scoped, connects on start, disconnects on finish; reference = shares parent connection.
2. Hide a heavy MCP server from main by defining it inline in the subagent.
3. Parent `bypassPermissions`/`acceptEdits`/`auto` override the child's `permissionMode`.
4. Managed MCP restrictions cover frontmatter servers; explicit `--agents`/SDK input is exempt from `--strict-mcp-config`.
5. Use `bypassPermissions` sparingly — broad write access.

## Connects To
- **Ch 5**: `disallowedTools: mcp__<server>` removes a server's tools (different from scoping access in).
- **Ch 8**: hooks give finer per-command validation than permission modes.
- **Ch 9**: `--agent` runs a definition as the main session.
