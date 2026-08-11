## 1. The named order

- [x] 1.1 Replace the artifact order list in `src/scanner.ts` with `summary`, `proposal`, `spec`, `design`, `tasks`, `review`, so the summary leads and the review closes
- [x] 1.2 Confirm the list entry for delta specs is the singular `spec`, matching the artifact name `collectMarkdownFiles` derives from `specs/<capability>/spec.md`, and not the `specs` that never matched
- [x] 1.3 Leave `artifactSortKey`'s fallback rank in place so an artifact the list does not name still sorts after every named one

## 2. Stable ordering

- [x] 2.1 Extract the artifact comparator currently inlined at both call sites into one shared function in `src/scanner.ts`, so open and archived changes cannot drift apart
- [x] 2.2 Break ties on the artifact's `slug` — derived from the path relative to the change directory, so it is unique within a change and independent of `readdir` order
- [x] 2.3 Use the shared comparator in both `scanChanges` and `scanArchivedChanges`

## 3. Verification

- [x] 3.1 Compile, then read this repo's own `unify-cli-under-opsx-tools` archived change and confirm its artifacts come back as proposal, both spec files, design, tasks — the spec files no longer last
- [x] 3.2 Confirm the two spec files of that change come back in the same sequence across repeated scans of the unchanged directory
- [x] 3.3 Add a `summary.md` and a `review.md` to a scratch change, scan it, and confirm the summary is first and the review is last
- [x] 3.4 Add a Markdown file the order does not name to that scratch change and confirm it sorts after the review, separating no named artifact
- [x] 3.5 Scan an open change and an archived change holding the same artifacts and confirm both return them in the same order
- [x] 3.6 Confirm artifact slugs are unchanged, so an address that reached an artifact before the reordering still reaches it
