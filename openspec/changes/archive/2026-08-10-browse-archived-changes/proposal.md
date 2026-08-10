## Why

Archived changes are the project's written history — the reasoning behind decisions already made — and `opsx-read` currently has no way to show them. The scanner skips `archive/` outright, so a project whose work is all archived gets an empty reader and a warning that names the archive without offering any way to open it. The one path that does reach archived content today (`opsx-read openspec/changes/archive`) flattens every archived change into a single page of same-named artifacts, which is worse than no support at all.

## What Changes

- Add an explicit `--archived` CLI option that includes archived changes in the reader. Archived changes SHALL never appear without the user asking — no automatic fallback when the open set is empty.
- Add a web toggle so archived changes can be shown or hidden without restarting the server. The CLI option sets the initial state; the toggle changes it per request.
- Present archived changes as their own labelled group in the index, ordered most-recent-first, separate from the open changes, and never mixed into the open list.
- Read the date and display name from the archived directory name (`YYYY-MM-DD-<name>`) and show the archive date as metadata. Tolerate archived directories without a date prefix rather than failing.
- Route archived changes under their own path namespace so an archived change and an open change with the same base name cannot collide.
- Mark an archived change's page as archived, with its date, so old task lists are not mistaken for pending work.
- Resolve an archived change by name as a target, and suggest archived names when an unresolvable target closely resembles one.
- Point the "no open changes" warning at the option that would show the archive.
- **BREAKING**: `opsx-read openspec/changes/archive` no longer serves one flattened pseudo-change containing every archived artifact. It serves the archive as a list of archived changes.

## Capabilities

### New Capabilities
- `archive-browsing`: How archived changes are discovered, identified, dated, ordered, addressed, and labelled when the reader is asked to show them — including the requirement that showing them is always explicit.

### Modified Capabilities
- `cli-interface`: The invocation surface gains an option for including archived changes; target resolution learns to resolve and suggest archived change names; the empty-changes report gains a next step.

## Impact

- `src/scanner.ts` — the `archive/` exclusion, and a way to scan archived changes with their dates.
- `src/types.ts` — `Change` gains archived identity; `TargetMode` gains the archive-listing case; `ServerOptions` carries the initial archived state.
- `src/cli.ts` — the new option, target resolution for archived names, close-match suggestions, and the empty-state message.
- `src/server.ts` — per-request archived state, the archived-change route, and the archive listing.
- `src/renderer.ts` — the archived group in the index, the toggle control, and the archived banner on a change page.
- `openspec/specs/cli-interface/spec.md` — updated requirements.
- No new dependencies. No change to how open changes are read today.
