## Context

See proposal.md — Why. Four facts about the current shape constrain the approach:

- `listPackagedSkills()` derives the installable set by listing directories under
  the package's `skills/` that contain a `SKILL.md` (`src/skill-source.ts:39`).
  The set is closed but not enumerated in code, so a new skill needs no source
  change to become installable, listable and removable.
- A skill's `/command` name is its **directory name**, not its `name:`
  frontmatter. `skills/openspec-summarize-change/` is what makes
  `/openspec-summarize-change` exist.
- `skills/openspec-review-change/SKILL.md` establishes the house style for a
  skill in this package: numbered steps, a `## Live context` block of `!`-prefixed
  commands captured at load time, explicit `allowed-tools`, `## Guardrails` at the
  end, and questions asked through `AskUserQuestion` rather than as prose.
- The `skill-installation` spec is written generically about what ships, so this
  change exercises it rather than modifying it.

One fact about this repository is worth naming because it is the *normal* case
rather than an edge case: its changes and specs are written in English while its
maintainer works in Portuguese. Any language rule that treats mixed as
exceptional is wrong here.

## Goals / Non-Goals

**Goals:**
- Stay cheap. The value of this skill is that it costs less than reading the
  change, so its own cost has to stay well below a review's.
- Make the prohibitions structural rather than promised — a skill that "does not
  read the code" but holds `Grep` and `Bash(git …)` is one instruction away from
  doing it.
- One output path, forever, whatever the language.

**Non-Goals:**
- Any judgement about the change. See the spec's *Summarizing describes and does
  not judge*.
- Any awareness of implementation state, which is what keeps the output stable.
- Language support beyond English and pt-BR. A general localization surface is a
  different design; two named languages is a list.

## Decisions

### A second skill, not a mode of `openspec-review-change`

Alternative: a lightweight mode of the review skill, selected by argument.

Rejected on three counts. Skills are addressed by directory name, so a mode is
not reachable as a command — the user would have to know to pass a flag to a
skill whose description promises verification. The two have opposite cost
profiles (`effort: high` with subagent fan-out versus a single linear read), and
one file cannot declare both. And the installer's unit is a directory: a mode
could not be installed or removed on its own.

### The skeleton lives inline in `SKILL.md`, not in `references/`

Alternative: `references/summary-template.md`, mirroring the review skill's
`references/report-template.md`.

A reference file earns its keep when it is read *conditionally* or when it is
large enough that inlining would bloat every invocation — which is why the review
skill has three. This skeleton is neither: it is around thirty lines and it is
read on every single invocation, so extracting it converts one file read into two
and saves no context. It is also not supporting material — it *is* the skill's
product definition. Inline, and the skill ships as a single file that can be read
in one sitting.

### The prohibitions are enforced by `allowed-tools`

The spec forbids reading `tasks.md`, git history and source code. Stating that in
prose makes it a promise; omitting `Grep` and every `Bash(git …)` pattern from
`allowed-tools` makes it a wall. The surface is `Read`, `Glob`, `Write`,
`AskUserQuestion`, and `Bash(openspec:*)`.

`Bash(openspec:*)` is admitted for one job — locating the change and its artifact
paths via `openspec list --json` and `openspec status --change … --json`. That
listing incidentally reports `completedTasks`/`totalTasks`, which is why the spec
forbids *carrying* progress into the summary rather than pretending the numbers
are never seen.

`Read` cannot be scoped to specific filenames, so `tasks.md` stays technically
reachable. That one prohibition remains a stated rule, and it is the only one.

### The language question is unconditional; detection only orders the options

Alternative, and the originally requested rule: ask only when the change is
written in English, and write pt-BR silently when it already is.

The asymmetric rule has an undefined third case — mixed — which is this
repository's normal state, so it would need a special rule for its most common
input. Asking unconditionally deletes that case instead of answering it. The cost
is one keystroke, because the detected language is offered first as the
recommended option; the benefit is that detection can never produce a wrong file,
only a suboptimally ordered question. That in turn is what makes a heuristic
acceptable here and rules out taking on a language-detection dependency.

Detection reads **prose only**. Fenced and inline code, paths, identifiers,
schema headings (`## ADDED Requirements`, `### Requirement:`, `#### Scenario:`)
and requirement keywords (`SHALL`, `WHEN`, `THEN`) are always English regardless
of who wrote the change, so a whole-file judgement reports every change as
English. Precedence is `proposal.md` first, `design.md` as tie-breaker when the
proposal is absent or too thin on prose, spec files last.

### The chosen language applies to the whole file, headings included

A pt-BR summary carries pt-BR section headings. Alternative — fixed English
headings with translated body — would keep the file machine-recognizable across
languages, but nothing in this design parses the summary, and a half-translated
document reads worse than either language chosen wholly. The stable contract is
the *path*, not the headings.

### Overwrite in place, with no generation timestamp

Alternative: a `generated at …` footer, or language-suffixed history.

A timestamp invites the reader to reason about staleness, and the only staleness
this summary could have relative to time is staleness against tasks and code —
precisely what it refuses to model. Because it derives solely from the intent
artifacts, it is stale only when those change, and `git log -p summary.md` against
the artifacts' own history answers that better than a self-reported date.

### The report is the path, not the summary

The review skill prints its whole report because a review is consumed in the
moment. A summary is consumed later, by someone else, from the file — reprinting
it doubles its cost at the exact moment the user is paying for compression. What
the response owes is proof of the write: path and language.

## Risks / Trade-offs

- **Detection misjudges a mixed change** → It reorders two options in a question
  that is asked either way; the wrong order costs one extra keystroke and can
  never produce a file in the wrong language.
- **The summary silently drifts once proposal or design is edited** → Accepted,
  and deliberately not mitigated with a timestamp. Regeneration is cheap and
  overwriting is unconditional, so the fix is to re-run rather than to detect.
- **`summary.md` is an unrecognized file inside a change directory** → Verified
  harmless: with a stray `summary.md` present in this change's own directory,
  `openspec validate add-summarize-change-skill --strict` still reports
  `valid: true` with no issues. Archiving is not separately exercised, but it
  relocates the change directory wholesale, so an extra file travels with it.
- **`Read` cannot be restricted, so `tasks.md` stays reachable** → Named as the
  single prohibition that rests on instruction rather than on tool scope, so it is
  not mistaken for one the tool surface enforces.
- **Two skills where the README documents one** → The README's intro list and its
  install section are both worded for the review skill alone and are corrected in
  this change; leaving them would make the second skill appear only in
  `opsx-skills` output.

## Migration Plan

Nothing to migrate. The skill's arrival is additive: `opsx-skills` picks it up
from the directory listing on the next invocation, with no rebuild — this change
adds no TypeScript, so committed `dist/` output stays valid.
