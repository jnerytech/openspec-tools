# OpenSpec conventions to check

Read at Step 7, when validating the change against the existing specs.

## Delta markers

A change's `specs/**/spec.md` is a **delta**, not a replacement for the main spec. Check each section carries the right marker and does what the marker promises:

| Marker | Must contain |
|---|---|
| `## ADDED Requirements` | requirements that do not exist in the main spec |
| `## MODIFIED Requirements` | the full new text of a requirement that already exists — not a diff fragment |
| `## REMOVED Requirements` | the requirement being dropped, plus why |
| `## RENAMED Requirements` | old name → new name |

Findings to look for:

- A requirement under ADDED that already exists in `openspec/specs/` — it is a MODIFIED in disguise and will silently overwrite the original.
- MODIFIED sections quoting only the changed line; the main spec's untouched clauses vanish on archive.
- Delta paths that do not mirror the main spec's capability path (`specs/<capability-path>/spec.md`) — the archive step will not find its target.
- Requirements edited with no marker at all.

## Requirements and scenarios

- Every requirement carries at least one `#### Scenario:`.
- A scenario is testable: concrete precondition, action, observable outcome. "Works correctly", "handles errors gracefully" and "is performant" are findings, not scenarios.
- Error paths and edge cases named in the proposal appear as scenarios, not only in prose.
- Requirement wording is normative (`MUST`/`SHALL`/`SHOULD`), not descriptive.

## Conflicts with existing specs

For each spec file the change touches, check whether the change contradicts a requirement or constraint that is still in force elsewhere in `openspec/specs/`. A contradiction that neither spec acknowledges is a critical finding — the archive will produce a spec that argues with itself.

## When unsure

Do not invent a rule. Compare against archived changes in the same root (`openspec/changes/archive/`) — they are the project's own precedent for structure, granularity and tone. `openspec instructions --json` states what the active schema actually requires.
