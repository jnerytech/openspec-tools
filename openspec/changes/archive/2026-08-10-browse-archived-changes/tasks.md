## 1. Archived change model and scanning

- [x] 1.1 Extend `Change` in `src/types.ts` with optional archived identity: the archive date (when the directory name carries a valid `YYYY-MM-DD-` prefix) and the display name stripped of that prefix
- [x] 1.2 Add a directory-name parser in `src/scanner.ts` that splits `YYYY-MM-DD-<name>` into date and display name, returning no date for a missing or malformed prefix without dropping the directory
- [x] 1.3 Add `scanArchivedChanges(changesDir)` in `src/scanner.ts` returning archived changes from `archive/`, one per immediate subdirectory holding at least one Markdown file, sorted newest-first with undated entries last in a stable order
- [x] 1.4 Derive archived slugs from the full directory name so two archived changes sharing a base name stay distinct
- [x] 1.5 Verify `scanChanges` still excludes `archive/` and that open changes are unchanged in content and order

## 2. CLI surface

- [x] 2.1 Add the `-a, --archived` option to the `opsx-read` command in `src/cli.ts`, defaulting to off, and carry it into `ServerOptions`
- [x] 2.2 Add the option and the archived-target form to the `TARGET`/`EXAMPLES` help text
- [x] 2.3 Extend `resolveMode` to resolve an archived change target by full directory name and by display name, resolving to the open change when both exist and reporting that the archived one also exists
- [x] 2.4 Add the archive case to `TargetMode` and route `openspec/changes/archive` to it instead of the single-change branch
- [x] 2.5 Add `openspec/changes/archive/<target>` to the attempted locations listed by `reportTargetNotFound`
- [x] 2.6 Include archived change names in `closeMatches` suggestions, labelling each suggestion as archived
- [x] 2.7 Extend the archive-only warning in `resolveDefaultMode` to name `--archived`, without displaying archived changes

## 3. Server state and routing

- [x] 3.1 Thread the initial archived state from `ServerOptions` into request handling in `src/server.ts`
- [x] 3.2 Read the archived state per request from the query parameter, falling back to the invocation's value
- [x] 3.3 Scan and pass archived changes to the index only when the current state includes them
- [x] 3.4 Add the archived-change route under its own path prefix, resolving by archived slug and returning 404 for an unknown one
- [x] 3.5 Serve the archive target mode as a listing of archived changes with no open-change section

## 4. Rendering

- [x] 4.1 Add a link-building helper in `src/renderer.ts` that carries the archived state through every link emitted by the index
- [x] 4.2 Render archived changes as their own titled section below the open changes, with the archive date shown per entry and undated entries showing none
- [x] 4.3 Render the reveal/hide control in the index header, reflecting the current state
- [x] 4.4 State plainly that there are no archived changes when they are requested and none exist
- [x] 4.5 Render the archived banner with the archive date on an archived change page, and confirm open change pages carry no banner

## 5. Verification and docs

- [x] 5.1 Run `opsx-read` in this repo with no option and confirm no archived change appears and the warning names `--archived`
- [x] 5.2 Run `opsx-read --archived` and confirm the archived section lists `improve-cli-error-guidance` dated 2026-08-10 and that its page carries the banner
- [x] 5.3 Reveal and hide archived changes from the running server and confirm no restart is needed and links preserve the state
- [x] 5.4 Run `opsx-read openspec/changes/archive` and confirm it lists archived changes instead of one merged page
- [x] 5.5 Run `opsx-read improve-cli-error-guidance`, `opsx-read 2026-08-10-improve-cli-error-guidance`, and an unresolvable target, confirming resolution, the three attempted locations, and the labelled archived suggestion
- [x] 5.6 Update `README.md` with the option, the archived-target form, and the changed `openspec/changes/archive` behavior
- [x] 5.7 Run `npm run compile` and `openspec validate --strict browse-archived-changes`
