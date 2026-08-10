## 1. Package wiring

- [x] 1.1 Add `@inquirer/prompts` to `dependencies` in `package.json`
- [x] 1.2 Add the `opsx-skills` entry to `bin`, pointing at `./dist/skills-cli.js`
- [x] 1.3 Confirm `tsconfig.json` picks up the new modules with no config change, and that `npm run compile` emits `dist/skills-cli.js`

## 2. Locating the packaged skills

- [x] 2.1 Add a module that resolves the package's own `skills/` directory from `import.meta.url`, never from `process.cwd()`
- [x] 2.2 Have it list the packaged skills by directory name, ignoring entries without a `SKILL.md`
- [x] 2.3 Verify the same resolution works from `src/` under `tsx` and from `dist/` after compile
- [x] 2.4 Verify it resolves correctly when the command is run from an unrelated working directory

## 3. Destinations

- [x] 3.1 Add a module that returns the two destinations — project and user — each with its absolute skills path
- [x] 3.2 Resolve the project destination by calling `resolveProject()` from `src/project.ts` unchanged, so it matches the reader's notion of a project
- [x] 3.3 Create a destination's skills directory on demand, and return whether it had to be created
- [x] 3.4 Report the restart caveat when a skills directory is newly created

## 4. Installed-state comparison

- [x] 4.1 Add a module that compares an installed skill directory against the packaged one over the whole tree, not just `SKILL.md`
- [x] 4.2 Return one of: not installed, installed and identical, differs from packaged, present but unreadable
- [x] 4.3 Compute state per skill per destination, with no state file written or read
- [x] 4.4 Verify a skill placed by `cp -r` reports as installed and identical

## 5. Install

- [x] 5.1 Copy a packaged skill directory to a chosen destination, preserving the directory name
- [x] 5.2 Skip and report an already-identical copy without prompting
- [x] 5.3 Report the difference and require confirmation before overwriting a differing copy
- [x] 5.4 Report each destination's outcome separately when several are selected

## 6. Remove

- [x] 6.1 List every absolute path to be deleted and require confirmation before deleting
- [x] 6.2 State in the confirmation when the installed copy differs from the packaged one
- [x] 6.3 Report each deleted path after removal
- [x] 6.4 Report a not-installed skill as such, delete nothing, and exit 0

## 7. Command surface

- [x] 7.1 Create `src/skills-cli.ts` with commander, declaring `install`, `remove`, and `list`
- [x] 7.2 Add destination options for project and user, selectable together, plus `--yes`
- [x] 7.3 Accept skill names as arguments; prompt with a checkbox when none are given
- [x] 7.4 Prompt for destinations with a checkbox when neither destination option is given
- [x] 7.5 Implement the bare invocation: present skill × destination pairs with current state as an editable selection, apply the diff
- [x] 7.6 Summarize the writes and deletions and confirm before applying a bare-invocation selection; do nothing when the selection is unchanged
- [x] 7.7 Add `--help` and `--version`, exiting 0 without installing or removing

## 8. Errors and non-interactive behaviour

- [x] 8.1 Detect a non-interactive stdin before prompting; report the missing choice, name the option that supplies it, exit 1, write nothing
- [x] 8.2 Reject an unknown skill name and list the skills the package ships
- [x] 8.3 Reject unrecognized options rather than ignoring them
- [x] 8.4 End every usage error with a pointer to `opsx-skills --help`, without printing the full usage listing alongside it
- [x] 8.5 Return 0 for completed actions including no-ops, and 1 for invocations that could not be carried out

## 9. Documentation

- [x] 9.1 Replace the `cp -r skills/...` install instructions in `README.md` with `opsx-skills`
- [x] 9.2 Remove `/opsx:review` from `README.md` and document the skill's real command name, `/openspec-review-change`
- [x] 9.3 Document the two destinations, the three verbs, the bare sync invocation, and `--yes`
- [x] 9.4 Add `opsx-skills` and the new modules to the project structure section of `README.md`

## 10. Verification

- [x] 10.1 Run `npm run compile` and commit the `dist/` output, since installs from a git ref run no build step
- [x] 10.2 Verify from a global install that `opsx-skills` finds its packaged skills and installs to both destinations
- [x] 10.3 Verify that a skill directory present at a destination but not shipped by the package is never listed, offered, or removed — check specifically against the OpenSpec skills in this repo's own `.claude/skills/`
- [x] 10.4 Verify a piped invocation missing a destination fails with guidance instead of hanging or defaulting
- [x] 10.5 Verify overwrite and removal of a locally modified copy both warn and respect a declined confirmation
