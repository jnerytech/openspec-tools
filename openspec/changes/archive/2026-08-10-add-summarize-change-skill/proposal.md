## Why

The package ships one skill for reading a change, and it is the expensive one:
`openspec-review-change` verifies every factual claim against the repository,
fans out subagents, and ends in a verdict. There is nothing for the far more
common need — *what is this change, in one minute* — so a reader who only wants
orientation either pays a reviewer's price or opens `proposal.md`, `design.md`
and every file under `specs/` and reconstructs the picture by hand.

That reconstruction is the same work every time, and its most valuable output is
the one thing scattered widest: the decisions, each with the alternative it beat.
A newcomer who cannot find those re-litigates them.

## What Changes

- A second packaged skill, `openspec-summarize-change`, that writes a short
  orientation summary of one open change.
- It derives the summary from **`proposal.md`, `design.md` and `specs/**/spec.md`
  only**. It never reads `tasks.md`, never reads task progress, never reads git
  or source code. The summary therefore describes the change's intent and shape,
  not its state, and does not go stale as work proceeds.
- It **always asks** which language to write in — English or pt-BR — offering the
  language the change's own prose is written in as the first option.
- It writes exactly one file, `openspec/changes/<name>/summary.md`, overwriting
  any previous one; git carries the history. The filename never varies with the
  chosen language, so anything pointing at the summary can keep pointing at it.
- It does not print the summary in the response. It reports the path it wrote and
  the language it used.
- Summarizing an archived change requires explicit confirmation first, matching
  the stance `openspec-review-change` already takes toward `archive/`.
- It describes; it does not judge. Noticing a contradiction between artifacts
  earns one pointer to `openspec-review-change`, not a finding.
- The README stops describing a single review skill and describes the two skills
  the package now ships.

No installer work is needed. `skill-installation` already fixes the installable
set as "the skills directory of its own installed package", derived by listing
directories that contain `SKILL.md`, so the new skill becomes installable,
listable and removable the moment its directory exists.

## Capabilities

### New Capabilities

- `change-summary`: what a generated change summary contains, which artifacts it
  is derived from and which it is forbidden to read, how its language is chosen,
  where it is written, and what the skill reports afterwards.

### Modified Capabilities

None. `skill-installation` is written generically about which skills the package
ships — *"the installer SHALL treat the skills directory of its own installed
package as the complete and only set of installable skills"* — so shipping a
second skill exercises that requirement rather than changing it.

## Impact

- **New**: `skills/openspec-summarize-change/`, holding `SKILL.md` and any
  supporting reference file the design settles on.
- **Modified**: `README.md` — the intro list and the install section are both
  worded for one skill.
- **Unchanged**: no source file, no dependency, no `dist/` rebuild. This change
  adds no TypeScript.
- **Visible side effect**: `opsx-skills` and its bare checklist grow from one
  skill row per destination to two.
