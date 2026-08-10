## Context

See proposal.md — Why.

Four facts about the current code shape this design:

- `scanChanges` skips `archive/` with a single guard, and `Change` carries no notion of being archived or of when it was archived.
- The server holds `TargetMode` for the process lifetime but re-scans the filesystem on every request, so what the page shows is already derived per request rather than cached at startup.
- The renderer emits static HTML with no client-side JavaScript. The tool exists to be read aloud and read comfortably, and the output stays plain.
- `resolveMode` maps any directory under `openspec/changes/` to a single change, which is how `openspec/changes/archive` currently becomes one pseudo-change holding every archived artifact.

## Goals / Non-Goals

**Goals:**

- Keep archived and open changes as two clearly separate sets everywhere they surface: scanning, listing, addressing, and reading.
- Make revealing the archive cheap at read time — the common case is "I just want to check what that old proposal said."
- Add no client-side JavaScript and no dependency.

**Non-Goals:**

- Searching, filtering, or paginating the archive. A long list is acceptable until it is demonstrably not.
- Reading anything inside an archived change to classify it. Archive identity comes from the directory name only.
- Any archiving action. `opsx-read` reads; `openspec archive` writes.
- Remembering the toggle state across restarts. The invocation decides the initial state each run.

## Decisions

### Display is explicit, never inferred

Archived changes appear only when the user supplies the option or names one. The rejected alternative was to fall back to the archive when the open set is empty — the exact situation that prompted this change. It was rejected because implicit fallback makes the same command mean different things depending on directory state: a user who sees a change listed cannot tell whether it is work in progress without reading the label. Instead the empty-state report names the option, so the discovery path is a sentence rather than a behavior.

### The option sets the initial state; a query parameter carries the current one

`-a, --archived` sets whether the first page load includes archived changes. The index then renders a link that flips the state via a query parameter, and each request derives its answer from that parameter, defaulting to the invocation's value.

This works because the server already re-scans per request; archived-ness is a render input, not process state. Alternatives considered:

- **Flag only.** Simplest, but seeing history costs a restart, and the reader is meant to stay open next to the editor.
- **Client-side toggle.** Would hide and show already-rendered sections, but introduces the first script tag into an intentionally script-free renderer, and would have to render the archive on every load to have something to hide.
- **A separate mode that shows only the archive.** A third mode to explain in help for a case the include-option already covers.

Links out of the index carry the parameter forward so returning from a change does not silently drop the state.

### Archive date comes from the directory name

`openspec archive` names directories `YYYY-MM-DD-<name>`, so the date and display name are already there. Parsing the prefix costs no I/O and is stable across clones and checkouts.

Alternatives: directory `mtime` (wrong after a fresh clone or a file touch) and git history (a hard dependency on a repo, and slow). Both were rejected. A directory without a valid prefix keeps its full name and reports no date rather than being dropped — the archive is user-owned and may contain hand-moved directories.

### Archived changes are scanned as their own set

Rather than adding an `includeArchived` option to `scanChanges` and returning one mixed list, archived changes are scanned by their own function returning archived-typed values. The index then holds two lists, which is what it renders. A single mixed list would force every consumer — sorting, routing, the empty check, the CLI warning — to re-partition by a boolean, and the two sets genuinely differ: they sort by different keys, address differently, and one of them can be empty without that meaning anything is wrong.

`Change` gains the archived identity as optional data rather than a second type, so `renderChange` keeps working for both and only decides whether to draw the banner.

### Archived changes get their own address space

An archived change is addressed under a separate path prefix from open changes. Two changes with the same base name — the common case of revisiting work — otherwise resolve by array order, which is arbitrary. The alternative, keeping one address space and relying on the date prefix in the slug, breaks as soon as the archived name is used without its date. The archived slug derives from the full directory name, so two archived changes with the same base name and different dates also stay distinct.

### Name conflicts resolve to the open change, out loud

When a target names both an open and an archived change, the open one is served and the CLI says the archived one exists. Serving the archived one would surprise a user working on live changes; failing with an ambiguity error would punish the common case to protect the rare one. This follows the existing error-guidance stance: pick the likely intent, then name the other option.

### The archive directory becomes its own target mode

`TargetMode` gains an archive case so `openspec/changes/archive` renders a listing instead of matching the generic "directory under changes/" branch. This is the behavior change flagged as breaking in the proposal. It is treated as a fix rather than a removal: the current output — one page whose table of contents reads `proposal, design, tasks, proposal, design, tasks` — has no legitimate use.

### Grouped sections, not badges in one list

Archived changes render as their own titled section below the open ones. A single list with an "archived" badge reads fine at three entries and badly at forty, and forty is the steady state of a project that ships. Sections also make the ordering difference — open alphabetical, archived newest-first — legible instead of looking like a bug.

## Risks / Trade-offs

- **A large archive makes the index long.** → Sections keep open changes at the top, where they were before; the archive is below the fold and only present when asked for. Pagination stays a non-goal until someone hits the wall.
- **The query-parameter toggle is state in a URL, so a shared or bookmarked link carries it.** → Acceptable, and arguably useful. The invocation still sets the default for a fresh load.
- **Every link rendered from the index must carry the toggle state or it is silently lost.** → State is threaded through link construction in one place in the renderer rather than at each call site.
- **Archived directories are user-owned and may be malformed.** → Undated and oddly named directories are listed rather than skipped or fatal; only directories with no Markdown at all are omitted.
- **Breaking the current `archive/` targeting could surprise someone who scripted against it.** → The replacement is reachable by the same command and the change is called out in the proposal; the tool is pre-1.0 and the old output was accidental.
- **Reading an archived task list still shows unchecked boxes from work that was abandoned rather than completed.** → The archived banner and date state the context; interpreting the contents stays the reader's job.

## Migration Plan

No data migration. The option defaults to off, so every existing invocation behaves as it does today except targeting `openspec/changes/archive` directly. Help text and README gain the option and the archived-target form. Rollback is reverting the release.
