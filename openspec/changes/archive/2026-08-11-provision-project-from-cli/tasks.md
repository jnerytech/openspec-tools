## 1. Project root resolution

- [x] 1.1 Add a `source` field (`"openspec" | "git" | "cwd"`) to `ProjectIdentity` in `src/types.ts`
- [x] 1.2 Set `source` in `resolveProject` (`src/project.ts`) according to which rule selected the root, leaving the returned `root` unchanged
- [x] 1.3 Confirm `read` and `skill` still behave identically — run `opsx-tools read` from a subdirectory and `opsx-tools skill list`, and check the resolved project is the same as before

## 2. Component abstraction

- [x] 2.1 Define the `Component` interface and the `State` and `Edit` types in a new `src/component.ts`: `inspect`, `plan`, `apply`, with `Edit` split into `PathEdit` (whole file or directory) and `RegionEdit` (lines inside an existing file)
- [x] 2.2 Implement the plan renderer: `PathEdit`s listed by absolute path under "Will be written" / "Will be deleted", `RegionEdit`s rendered as a `+`/`-` diff under the file's path
- [x] 2.3 Implement `apply` over a mixed plan, so a failure names the path involved and exits 1
- [x] 2.4 Add the component registry — a closed, compiled-in list, ordered as it is presented

## 3. Skills component

- [x] 3.1 Implement the skills component in `src/components/skills.ts`, wrapping `skill-source`, `skill-state`, and `skill-actions` — all packaged skills treated as one atomic item
- [x] 3.2 Report state by aggregating the per-skill states already produced by `skill-state.ts` (all installed, none installed, or partially installed / differing)
- [x] 3.3 Emit `PathEdit`s for installs and removals rather than writing directly, so the plan is confirmable as one set
- [x] 3.4 Support the project destination and the offered user destination, reusing `skill-destinations.ts`
- [x] 3.5 Confirm `src/skills-cli.ts` is unchanged and `opsx-tools skill` behaves exactly as before

## 4. Delimited region editor

- [x] 4.1 Implement the format-independent core in `src/region.ts`: find the delimiter pair, read the parameters recorded on the opening delimiter, and produce the replacement or excision as a `RegionEdit`
- [x] 4.2 Implement damaged-delimiter detection in the core — one delimiter present, or the closing one before the opening one — reporting the file as unsafe and changing nothing
- [x] 4.3 Implement region matching by delimiter only, never by resemblance, so an unrecognized region is reported rather than duplicated
- [x] 4.4 Implement the Markdown adapter: HTML-comment delimiters, no enclosing key, no indentation rules
- [x] 4.5 Implement the YAML adapter: locate the live `context:` key at column zero and determine the extent of its block scalar by indentation, without mistaking a commented-out example for a live key
- [x] 4.6 Implement the YAML adapter's supported-form detection, reporting anything else (`>`, `|2`, `|-`, a plain single-line string) as unsafe to edit, changing nothing and exiting 1
- [x] 4.7 Implement the YAML adapter's key lifecycle: create `context:` with a block scalar when absent, and remove the key when excising the region leaves it empty
- [x] 4.8 Verify the YAML adapter against the three starting states on real files: no `context:` key; `context:` holding user text; the commented-out example `openspec init` produces. Confirm every comment, key, and blank line outside the region is byte-identical afterwards

## 5. Artifact language component

- [x] 5.1 Implement the component in `src/components/artifact-language.ts`, producing `RegionEdit`s through the YAML adapter
- [x] 5.2 Implement resolution of the project configuration file — `openspec/config.yaml` or `openspec/config.yml`, whichever exists, never creating a second one
- [x] 5.3 Implement the delimiter format carrying `lang=<value>`, and read the configured language back from it in `inspect`
- [x] 5.4 Implement the directive text: names the chosen language, scopes itself to OpenSpec artifacts, and claims nothing about conversation, code, or commit messages
- [x] 5.5 Implement the language choice — an offered list plus a value the user supplies themselves
- [x] 5.6 Implement replacement on language change, so exactly one region remains after any provisioning
- [x] 5.7 Implement the differing-region path: report the difference, show it, and require confirmation before replacing or removing
- [x] 5.8 Report a missing configuration file and provision nothing, rather than creating one

## 6. Claude Code working agreements component

- [x] 6.1 Implement the component in `src/components/claude-workflow.ts`, producing `RegionEdit`s through the Markdown adapter against `CLAUDE.md` at the resolved project root
- [x] 6.2 Implement the delimiter format recording which agreements are enabled, and read them back in `inspect`
- [x] 6.3 Implement the two directives — keeping a task list, and asking rather than assuming — each independently switchable and each scoped in its text to work on files under `openspec/`
- [x] 6.4 Implement creating `CLAUDE.md` when it does not exist, and recording that the package created it
- [x] 6.5 Implement removal: excise the region; remove the file only when the package created it and nothing else remains; keep a file the user created even when it is left empty
- [x] 6.6 Implement selecting neither agreement as equivalent to removing the component
- [x] 6.7 Confirm the component writes nothing to the OpenSpec configuration file or to `AGENTS.md`
- [x] 6.8 Review every string this component prints for claims of enforcement, and phrase them as directives delivered

## 7. The init subcommand

- [x] 7.1 Add `initCommand()` in `src/init-cli.ts` and register it in `src/main.ts`
- [x] 7.2 Implement the precondition — refuse when the resolved root's `source` is not `"openspec"`, naming `openspec init`, exiting 1 before prompting for anything
- [x] 7.3 Implement the interactive checklist over the registry, pre-checked to current state, with full reconcile semantics
- [x] 7.4 Implement per-component prompts for parameters — the language choice, and which working agreements to enable — asked only for selected components
- [x] 7.5 Implement the plan-then-confirm step over the combined plan from every selected component
- [x] 7.6 Implement the non-interactive surface: additive component flags, `--no-<component>` for removal, `--lang <value>`, the flags selecting individual working agreements, `--project`, `--user`, `-y/--yes`
- [x] 7.7 Implement the missing-choice error path, naming the option that supplies each missing answer and exiting 1 without writing
- [x] 7.8 Add the `init` help text with destinations, examples, and a note that `opsx-tools skill` is the fine-grained surface
- [x] 7.9 Print the suggestion to run `openspec update` after provisioning skills, without executing it
- [x] 7.10 Confirm no code path invokes another command-line program

## 8. Verification

- [x] 8.1 Verify the refusal path in a git repository with no `openspec/` — error names `openspec init`, exit code 1, nothing written, no prompt shown
- [x] 8.2 Verify a full provisioning run in a scratch OpenSpec project: all three components selected, diff shown, confirmation applied, and the resulting `config.yaml` and `CLAUDE.md` diffed against the originals
- [x] 8.3 Verify reconciliation: re-run, deselect every component, confirm the skills are removed, the YAML region and its now-empty `context:` key are gone, and the Markdown region is gone
- [x] 8.4 Verify the language change path: provision one language, provision another, confirm exactly one region remains
- [x] 8.5 Verify the working agreements against a pre-existing `CLAUDE.md` holding user content — content preserved on write, on change, and on removal, and the file kept when emptied
- [x] 8.6 Verify the created-then-removed path: no `CLAUDE.md`, provision, remove, and confirm the file is gone rather than left empty
- [x] 8.7 Verify the damaged-delimiter path in both formats — changes nothing, exits 1
- [x] 8.8 Verify the non-interactive paths — flags supplied run without prompting; a missing choice with piped input reports the option and exits 1; a component not named is neither provisioned nor removed
- [x] 8.9 Verify `opsx-tools --help` lists `read`, `skill`, and `init`

## 9. Documentation and build

- [x] 9.1 Add an `init` section to `README.md` covering the precondition, the three components, reconcile semantics, and the flags
- [x] 9.2 Document where each component writes and why the destinations differ, so the split between `openspec/config.yaml` and `CLAUDE.md` is not read as an inconsistency
- [x] 9.3 Update the README install flow to lead with `opsx-tools init`, keeping `opsx-tools skill` documented as the fine-grained surface
- [x] 9.4 Review the README for any claim that a directive makes the agent behave a certain way, and phrase it as a directive delivered
- [x] 9.5 Run `npm run compile` and commit the updated `dist/`
- [x] 9.6 Verify a fresh `npm install -g` from the working tree provides a working `opsx-tools init`
