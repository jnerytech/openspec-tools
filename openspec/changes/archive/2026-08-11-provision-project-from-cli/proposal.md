## Why

After `npm install -g github:jnerytech/openspec-tools`, the package has done
nothing to the repository the user actually works in. Setting it up means
knowing that `skill` exists, that `--project` is the flag, and that the skills
are the thing to install — a set of facts the user has to have read the README
for. There is no single command that answers *"what does this package have for
this repo, and how much of it is set up?"*

That is a small problem today, with one provisionable thing. It stops being
small the moment there is a second: without a shared surface, each new thing
arrives as its own verb, with its own notion of installed state, its own
confirmation prompt, and its own flags — and the user has to learn each one to
discover it exists.

## What Changes

- Add an `init` subcommand that provisions **this repository** with everything
  the package offers, presented as one checklist of components with their
  current state. Checking provisions, clearing removes.
- `init` **requires** an OpenSpec project and never creates one: if no
  `openspec/` directory owns the resolved root, it reports that and names
  `openspec init`, exiting 1. Everything the package provisions is meaningless
  without OpenSpec, so proceeding would produce a repository configured for a
  tool it does not use.
- Introduce a **component** as the unit `init` operates on: something that can
  report its state, name the writes and deletions it would make, apply them,
  and undo them. Three components ship with this change:
  - **Skills** — the skills the package already ships, treated as one atomic
    item. `init` provisions all of them or none; `opsx-tools skill` remains the
    fine-grained surface for individual skills and verbs.
  - **Artifact language** — a directive fixing the language OpenSpec artifacts
    are written in, chosen by the user during `init`.
  - **Claude Code working agreements** — directives asking the agent to keep a
    task list and to ask rather than assume while working under `openspec/`,
    each independently switchable.
- The artifact-language component writes its directive into the `context` field
  of `openspec/config.yaml`, which OpenSpec injects into every artifact
  instruction. The edit is **surgical text editing**, never parse-and-rewrite:
  that file is mostly explanatory comments, and a YAML round-trip would destroy
  them. The directive lives inside a self-describing managed region that records
  the chosen language, so `init` can report *which* language is set rather than
  only that something is.
- The Claude Code working agreements go to **`CLAUDE.md`**, not to
  `openspec/config.yaml`, because they name Claude Code's own tools. OpenSpec's
  configuration is read by every AI tool it supports, and a directive about a
  tool that only one of them has does not belong in a file the others read.
  Both components use the same delimited-region mechanism over different file
  formats, so the destination is a property of the component rather than a
  second way of doing things.
- `init` is a **reconciler, not an adder**: an item present and unchecked is
  removed. This is how `opsx-tools skill` already behaves, and it means no
  separate uninstall verb is needed.
- Because `init` can now delete lines from a file the user owns, naming the
  path is no longer enough. Edits inside an existing file SHALL be presented as
  a **diff** before confirmation. When the region `init` wrote has since been
  edited by hand, `init` reports the difference and asks — it never removes by
  approximation and never re-adds a directive it failed to find.
- Skills default to this project, and `init` offers the user destination as
  well; the artifact-language component is project-only, having no other
  meaningful destination.
- Every prompt gets a flag equivalent, so `init` is usable when input is not a
  terminal — matching the stance already established for `skill`.
- Make explicit, as a specified constraint, the invariant the package already
  follows: **nothing `opsx-tools` decides or reports depends on the output or
  exit code of another program.** `init` therefore does not run `openspec
  update`, does not shell out to check the OpenSpec version, and detects the
  OpenSpec project from the filesystem alone.
- `src/project.ts` gains the reason a root was chosen (`openspec`, `git`, or
  `cwd`). It currently collapses "found `openspec/`" into "fell back to the
  repository root", which is precisely the distinction `init`'s precondition
  turns on.

## Capabilities

### New Capabilities
- `project-provisioning`: what a provisionable component is, the precondition
  `init` enforces, how components and their state are presented as one editable
  selection, how writes and deletions are named and confirmed, how unchecking
  removes, and how the same choices are supplied when input is not a terminal.
- `artifact-language`: the component that fixes the language of OpenSpec
  artifacts — where the directive is written, how it is delimited so it can be
  found again, how the chosen language is read back, how it is removed, and
  what happens when the user has edited it.
- `claude-workflow-directives`: the component that records Claude Code working
  agreements for work under `openspec/` — which directives are offered, where
  they are written, how they are scoped, and what the package does and does not
  claim about the agent following them.

### Modified Capabilities
- `cli-interface`: the requirement enumerating one subcommand per capability
  names `read` and `skill` as the complete set, and the root-help scenario
  asserts exactly those two are listed. Both change to include `init`.

## Impact

- `src/main.ts`: registers the new subcommand.
- New source modules: the component abstraction and its registry, the `init`
  command surface, a delimited-region editor split into a format-independent
  core and one adapter per file format (YAML block scalar, Markdown), and the
  three components.
- `src/project.ts`: `resolveProject` reports which rule selected the root. The
  returned root itself is unchanged, so `read` and `skill` are unaffected.
- `src/skill-actions.ts`, `src/skill-destinations.ts`, `src/skill-source.ts`:
  reused as the Skills component's implementation. No behaviour change.
- `src/skills-cli.ts`: unchanged. `opsx-tools skill` keeps its current surface.
- `README.md`: an `init` section, and the install instructions leading with it.
- `dist/`: committed, as the package installs without a build step.
- No change to the reader, the server, the renderer, or the scanner.

## Non-goals

- **Installing or initializing OpenSpec.** `init` presupposes it. Creating an
  `openspec/` directory on the user's behalf would mean deciding the schema and
  the tool set for them, which is what `openspec init` exists to ask.
- **Invoking any third-party CLI**, including `openspec update`. Nothing this
  change provisions requires it: a skill directory is read directly from
  `.claude/skills/`, and `openspec/config.yaml` is read directly by OpenSpec's
  own artifact instructions.
- **Writing to `AGENTS.md`.** It was the original candidate for the language
  directive and lost to `openspec/config.yaml`, which delivers the same text at
  the exact moment an artifact is written instead of occupying every session's
  context. It is also the wrong home for the Claude Code working agreements,
  which name tools no other client has, while `AGENTS.md` is the cross-tool
  convention. A future component may still write there, for content that is
  both always-on and tool-agnostic.
- **Guaranteeing that the agent obeys a directive.** The working agreements are
  instructions delivered into the agent's context, which is a strong nudge and
  not an enforcement mechanism. Nothing available here can compel a tool call:
  a Claude Code hook can intercept a tool call, not inject one that never
  happened. The package is responsible for the directive being present, correct,
  and removable — not for the behaviour downstream of it.
- **Using the per-artifact `rules` field.** It is semantically the better home
  for a language directive, but it is keyed by artifact id, and obtaining that
  list requires asking the OpenSpec CLI. `context` needs no enumeration.
- **Fixing the language of anything but OpenSpec artifacts.** Code comments,
  commit messages, and the agent's own replies are separate choices; one knob
  that claimed all of them would be wrong for most repositories.
- **Provisioning the user's home as `init`'s purpose.** `init` prepares a
  repository. It offers the user-level destination for skills because that
  choice is already established there, but `opsx-tools skill --user` remains
  the command for preparing yourself rather than a project.
- **A general-purpose plugin system.** The component registry is closed and
  compiled into the package; it exists to keep the second and third component
  cheap, not to accept components from outside.
