## Context

See proposal.md — Why. Four facts about the current package and one about
OpenSpec constrain the approach.

- **One binary, subcommands per capability** is already specified
  (`openspec/specs/cli-interface/spec.md`, "One binary, one subcommand per
  capability"), so `init` has an obvious home and needs no new executable.
- **`src/skills-cli.ts:175` already reconciles.** `syncInteractively` presents
  skill × destination pairs pre-checked to current state; checking installs,
  clearing removes. `init` is the same interaction one level up, over
  components instead of skills.
- **State is derived, never recorded.** `skill-state.ts` compares the installed
  directory against the packaged one. The `install-skills-from-cli` design
  rejected a manifest because it would be blind to skills copied by hand — the
  population that change existed to rescue.
- **`src/project.ts:51` conflates two answers.** `resolveProject` returns the
  nearest ancestor owning `openspec/`, else the repository root, else the cwd —
  but not *which* rule won. That distinction never mattered to `read` or
  `skill`; it is exactly what `init`'s precondition turns on.
- **`openspec/config.yaml` is mostly comments.** The file `openspec init`
  leaves behind is a `schema:` line followed by ~25 lines of commented
  documentation for `context`, `rules`, and `operations`. Nothing is written to
  those keys; they exist as examples.

Verified against the installed OpenSpec 1.8.0
(`@fission-ai/openspec`), not the checkout at `~/repos/OpenSpec`, which is
1.4.1 and differs on precisely these points:

- `dist/core/project-config.js:22-40` — `context: string`, described as
  *"Project context injected into all artifact instructions"*, and
  `rules: Record<artifactId, string[]>`, *"Per-artifact rules, keyed by
  artifact ID"*. The schema is `z.object()` without `.strict()`, so an unknown
  top-level key is silently discarded rather than rejected.
- `dist/core/project-config.js:42-48` — `operations` is a **closed** object with
  exactly two optional keys, `apply` and `archive`, each carrying a `guidance`
  list. Unlike `rules`, its keys need no enumeration from the CLI.
- `dist/core/project-config.js:441,445` — both `config.yaml` and `config.yml`
  are resolved.
- `dist/core/project-config.js:71` — a `context` whose trimmed length is zero
  is treated as absent.

## Goals / Non-Goals

**Goals:**

- One surface that answers "what does this package offer this repo, and what of
  it is set up?" without the user having to know the capability names first.
- A component abstraction general enough that the second and third components
  cost one file each, not one command surface each.
- Editing a user-owned configuration file without ever destroying a byte the
  package did not write.
- No new runtime dependency. The package has three.

**Non-Goals:**

- See proposal.md — Non-goals for scope boundaries.
- A general YAML editor. The editor handles the shapes `openspec init` produces
  and the shapes a user plausibly writes by hand, and refuses the rest rather
  than guessing.
- Sharing code between `init` and `skill` beyond what already exists.
  `skills-cli.ts` keeps its surface untouched; the Skills component wraps the
  same lower-level modules (`skill-source`, `skill-state`, `skill-actions`).

## Decisions

### A component abstraction, with skills as its first provider

Alternatives: `init` as a thin façade that calls the existing `skill` flow and
then each future feature's own flow; or no abstraction until a third component
arrives.

The façade is cheaper today and wrong by the second component. It would leave
each component inventing its own notion of state, its own confirmation, and its
own flags — which is the problem the proposal exists to prevent, reintroduced
one level down.

The abstraction is worth paying for now specifically because the two components
in this change have *different shapes*: one copies whole directories it owns
outright, the other edits a region inside a file the user owns. An interface
derived from one of them alone would have been wrong. Concretely:

```
  inspect(project)  → State      absent | provisioned(detail) | differs | unsafe
  plan(selection)   → Edit[]
  apply(Edit[])
```

An `Edit` is one of two kinds, and this split is what the confirmation display
needs:

```
  PathEdit    write or delete a whole file or directory   → shown as a path
  RegionEdit  add or remove lines inside an existing file → shown as a diff
```

Skills produce only `PathEdit`s; artifact-language produces only `RegionEdit`s.
Both kinds exist from day one, so the display and confirmation logic is
exercised by real callers rather than designed against a hypothetical.

### `context` over `rules`, forced by the no-third-party-CLI constraint

`rules` is the semantically correct home: "write this artifact in Portuguese" is
a rule about writing an artifact, not project background. It loses anyway.

`rules` is keyed by artifact id. Filling it requires knowing which artifacts the
project's schema defines, and the honest way to obtain that list is
`openspec instructions --json` — a third-party CLI invocation, which the
proposal forbids and which the spec now states as a constraint.

Reading OpenSpec's shipped schema files directly out of its global install
directory was considered and is worse than the CLI call: it depends on internal
file layout with no stability contract, and it fails outright for a project
using a schema defined locally.

`context` needs no enumeration — it is injected into *every* artifact
instruction by definition. The constraint picks the field, and picks correctly.

### AGENTS.md is not the target, and the reason changed during exploration

An early draft assumed a marker block in `AGENTS.md` risked being wiped by
`openspec update`. The source does not support that:

- `dist/core/config.js:63` — the `agents` tool value now means *shared
  `.agents/skills`*, not `AGENTS.md`. The `AGENTS.md (works with Amp, VS
  Code, …)` entry present in 1.4.1 is gone.
- `dist/core/legacy-cleanup.js:22` — root `AGENTS.md` is in
  `LEGACY_CONFIG_FILES`.
- `dist/core/legacy-cleanup.js:445` — *"Handle root AGENTS.md with OpenSpec
  markers — remove markers only, NEVER delete"*.
- `dist/utils/file-system.js:356` — `removeMarkerBlock` cuts from the start of
  the opening marker's line to the end of the closing marker's line and
  concatenates the remainder; `findMarkerIndex:54` requires an exact string
  match alone on its own line. `<!-- OPSX-TOOLS:START -->` cannot collide with
  `<!-- OPENSPEC:START -->`.

So a sibling block in `AGENTS.md` would have been safe. `AGENTS.md` loses on
merit instead: `config.yaml` delivers the directive at the moment an artifact is
written, while `AGENTS.md` occupies every session's context including the ones
that never touch OpenSpec. A future component may still write there for content
that genuinely needs to be always-on — the abstraction accommodates it.

### The destination follows the audience, not the topic

The Claude Code working agreements are about OpenSpec work, which makes
`openspec/config.yaml` look like the obvious home. It is the wrong one, and the
axis that decides is *who reads the file*:

```
  artifact language   content of an artifact   every AI tool   → openspec/config.yaml
  working agreements  Claude Code's own tools  one client      → CLAUDE.md
```

OpenSpec supports roughly thirty clients (`dist/core/config.js`, `AI_TOOLS`).
A directive naming `TaskCreate` placed in their shared configuration file is
delivered to every one of them, describing a tool only one has.

`operations.apply.guidance` was the serious alternative, and it is genuinely
reachable — its keys are a closed set of two, so unlike `rules` it costs no CLI
call. It still loses on three counts. It is read by every client, same as
`context`. It covers only `apply` and `archive`, with no key for `propose` or
`explore`. And it reaches the agent only when an OpenSpec command runs, while a
great deal of work on files under `openspec/` is done by opening one and
editing it — a path on which `config.yaml` delivers nothing and `CLAUDE.md`
delivers every time.

`AGENTS.md` loses to `CLAUDE.md` on the same axis: it is the cross-tool
convention, so Claude-specific tool names mislead there too. It remains the
right destination for a future component whose content is both always-on and
tool-agnostic.

### The package promises delivery, not obedience

"Always keep a task list" is a directive a model follows inconsistently, and
Claude Code already has its own heuristics for when to open one. No mechanism
available here changes that: a hook can intercept a tool call, not inject one
that never happened.

The specification is therefore written around what the package can actually
guarantee — the directive is present, correct, scoped, and removable — and the
requirement forbidding the package from claiming enforcement exists so that no
help text or report quietly promises more than that.

### Surgical line editing, not parse-and-serialize, and no YAML dependency

Loading `openspec/config.yaml` with a YAML library and writing it back destroys
every comment, the key order, and the formatting. For a file that is ~90%
commented documentation, that is a visible act of vandalism on the user's first
`init`.

The editor is therefore line-oriented, in the same spirit as OpenSpec's own
`removeMarkerBlock`. It needs to do exactly three things: find the `context:`
key at column zero, determine the extent of its block scalar by indentation, and
splice a delimited region in or out. That is not YAML parsing and does not
justify a fourth dependency.

Two components now need this over two file formats, so the editor splits into a
format-independent core — find the delimiters, read their recorded parameters,
replace or excise the region between them, refuse when they are damaged — and
one adapter per format:

```
  YAML adapter      locate the context: key, respect scalar indentation,
                    create the key when absent, drop it when emptied
  Markdown adapter  none of that: no enclosing key, no indentation rules
```

The Markdown adapter is by far the easier of the two, and writing the core
against the harder case first is what keeps it from being accidentally shaped
around YAML. `CLAUDE.md` also avoids the delimiter-leakage problem entirely,
since an HTML comment in Markdown is a real comment.

Three starting states, of which the third is the common one:

```
  1. no context: key                → insert the key with a block scalar
  2. context: with user content     → splice the region inside it
  3. context: present only as a     → this is what `openspec init` leaves;
     commented-out example             treat as case 1, and do not mistake
                                       the commented example for a live key
```

Case 3 is the one a naive implementation gets wrong, because the file *looks*
like it has a `context` key.

### The region delimiters are literal text inside the scalar

Inside a `|` block scalar, `#` is not a comment — it is part of the string. Any
delimiter therefore leaks into the text OpenSpec injects into artifact
instructions:

```yaml
context: |
  # opsx-tools:artifact-language lang=pt-BR
  Write every OpenSpec artifact in Brazilian Portuguese.
  # opsx-tools:end
```

Two lines of noise in the injected prompt. Accepted, for lack of a better
option: real YAML comments cannot delimit a region *inside* a scalar from
outside it, and a delimiter shaped as prose to read naturally cannot be matched
reliably — which is the one thing a delimiter exists to do.

The opening delimiter carries `lang=<value>`, which is what lets `inspect`
report *which* language is set rather than merely that something is. This is not
the manifest the `install-skills-from-cli` design rejected: that manifest was
rejected for being blind to installs it did not perform, and a parameter has no
pre-existing population to be blind to. The record also lives in the file it
describes, so the two cannot drift.

### Non-interactive flags are additive; removal must be named

The reconciler semantics create a trap. If `--skills` meant "skills selected,
everything else deselected", then a script written today would start *deleting*
a component added in a later release, silently, on the next CI run.

So: in non-interactive use, a component flag selects; nothing is deselected
unless explicitly named.

```
  opsx-tools init --skills --project --lang pt-BR --yes
  opsx-tools init --no-lang --yes            # removes the directive, touches nothing else
```

Alternative rejected: a comma list (`--with skills,lang`), which OpenSpec's own
`init --tools` uses. It has the same "unnamed means off" hazard, and it has
nowhere to carry the language value.

The interactive checklist keeps full reconcile semantics, because there the user
sees every component and its state before deciding — the information that makes
"unchecked means remove" safe is on screen.

### `resolveProject` reports which rule selected the root

Alternative: `init` performs its own search for `openspec/`.

Rejected for the reason `assign-port-per-project` and `install-skills-from-cli`
both recorded — one definition of "which project is this?", so `read`, `skill`,
and `init` cannot disagree. `ProjectIdentity` gains a `source` field
(`"openspec" | "git" | "cwd"`); the `root` it returns is unchanged, so existing
callers are unaffected and need no edit.

### Skills are one atomic item in `init`

`init` answers "set this repo up"; `skill` answers "install that skill there".
Keeping skills atomic in `init` means the checklist stays a handful of lines no
matter how many skills ship, and it keeps one obvious home for the fine-grained
choice instead of two half-surfaces.

## Risks / Trade-offs

- **The delimiters appear in the text sent to the agent** → Two short lines,
  adjacent to a directive that is itself instructions to the agent. No
  alternative preserves machine-matchability; accepted deliberately rather than
  discovered later.
- **`context` may hold YAML shapes the line editor cannot safely splice** —
  a folded scalar (`>`), an explicit indentation indicator (`|2`), a chomping
  indicator (`|-`), or a plain single-line string → The editor recognizes the
  forms it can handle and, for anything else, reports the file as unsafe to
  edit and changes nothing, per the spec's damaged-delimiter requirement.
  Refusing is always available and never destructive.
- **OpenSpec could change what `context` means or how it is delivered** → The
  region is content inside a string field, not a key of the package's own. Any
  future schema that still has `context: string` keeps working, and the failure
  mode if it does not is an inert directive, not a corrupted file.
- **`init` deletes lines from a file the user owns** → The highest-risk write in
  the package. Mitigated by three layers already specified: a diff shown before
  confirmation, a refusal to match the region by resemblance, and a refusal to
  edit at all when the delimiters are damaged.
- **The component abstraction may not fit a later component** → Three ship with
  this change, and they were not designed as variations of one another: one
  copies whole directories it owns outright, one splices a region into a YAML
  scalar inside a file OpenSpec owns, one splices a region into a Markdown file
  the user owns and may have to create. They exercise both edit kinds, both
  state models, and both file formats. The third arriving mid-planning and
  fitting without reshaping the interface is the strongest evidence available
  before a fourth exists.
- **Directives are a nudge and could be read as a guarantee** → The
  `claude-workflow-directives` capability forbids the package from claiming
  enforcement in any report, help text, or documentation. The risk is that
  someone writes such a claim anyway; the requirement is what makes that a
  review finding rather than an opinion.
- **`init` and `skill` both install skills into a project** → Two doors to one
  room, deliberately: coarse and fine. The risk is documentation, not
  behaviour, and the README is in scope.
- **`dist/` is committed, so installs need no build step** → The new subcommand
  must be compiled and its output committed with the change, or a fresh
  `npm install -g` gets a binary that does not have `init`.

## Migration Plan

No data migration. Users who previously ran
`opsx-tools skill install ... --project` have exactly the on-disk result the
Skills component compares against, so `init` reports them as already
provisioned and offers nothing to do — a no-op rather than a surprise.

Rollback is per-component and requires no special path: deselecting a component
in `init` removes what it wrote.

## Open Questions

- The exact prose of every directive the package writes: the language directive
  for each offered language, which languages appear in the offered list before
  "something else", and the phrasing of the two working agreements. None of it
  changes the specs, the approach, or the task breakdown — the requirements fix
  what each directive must name and scope itself to, not how it reads.
- Whether `init` should print the current state and exit when given a
  read-only flag, rather than requiring the user to open the checklist and
  cancel. `skill list` is the precedent for wanting one; it can be added later
  without disturbing anything specified here.
