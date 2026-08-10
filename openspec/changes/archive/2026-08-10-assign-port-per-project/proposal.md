## Why

`opsx-read` binds one hardcoded port for every project on the machine, and never handles the failure to bind it. Reading specs from a second repository therefore costs a `--port` flag the user has to invent, and forgetting it does not produce guidance — it produces an unhandled `EADDRINUSE` and a raw Node stack trace, which is exactly the dead-end the CLI's error guidance was built to eliminate. The tool is meant to sit open beside the editor across several repositories at once; today it is a tool you can only run once.

## What Changes

- Choose the listening port from the project's own identity instead of a fixed constant, so the same project always gets the same port and different projects almost never collide. Reading specs in N repositories requires no flag and no coordination.
- Resolve the project identity from the project root — the directory that owns `openspec/`, falling back to the repository root and then the working directory — so the chosen port does not depend on which subdirectory the command was run from.
- Fall back to the next free port when the preferred one is taken, reporting that the fallback happened and why, and failing with guidance rather than a stack trace when no port in the range is free.
- Announce the project the server is serving, on startup and in the browser, so several readers running at once can be told apart by name rather than by port number.
- Report a busy explicitly requested `--port` as a guided error instead of an unhandled exception, and point at the automatic behaviour as the way out.
- **BREAKING**: `opsx-read` no longer listens on 4242 by default. The port is derived per project unless `--port` is given.

## Capabilities

### New Capabilities
- `server-startup`: How the reader decides which port to listen on, how it recovers when that port is unavailable, and how it identifies the project it is serving to the user.

### Modified Capabilities
- `cli-interface`: `--port` becomes an override of an automatic choice rather than a replacement for a fixed default, and the usage output must say so.

## Impact

- `src/cli.ts` — the `--port` default becomes absent rather than `4242`; project root resolution; help text for the new default behaviour.
- `src/types.ts` — `ServerOptions` carries the project identity and an optional requested port rather than a resolved one.
- `src/server.ts` — port derivation, bind-failure handling and fallback, and the startup banner.
- `src/renderer.ts` — the project name in the page title and header.
- `openspec/specs/cli-interface/spec.md` — the `--port` requirement.
- No new dependencies. Nothing changes about how a change is discovered, rendered, or read.
