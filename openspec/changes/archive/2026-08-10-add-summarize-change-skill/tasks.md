## 1. Author the skill

- [x] 1.1 Create `skills/openspec-summarize-change/SKILL.md` with frontmatter matching the sibling skill's field set, `effort: low`, and `allowed-tools` limited to `Read`, `Glob`, `Write`, `AskUserQuestion` and `Bash(openspec:*)` — no `Grep`, no `Bash(git …)`
- [x] 1.2 Write the target-selection step: one change per invocation, ask when not supplied, confirm even when only one is open, name the real changes on an unknown target, and confirm by name before touching anything under `archive/`
- [x] 1.3 Write the reading step, scoped to `proposal.md`, `design.md` and the spec files, with `tasks.md`, git and source code named as off-limits
- [x] 1.4 Write the language step: detect from prose only (ignoring code, paths, identifiers, schema headings and requirement keywords), then always ask English vs pt-BR with the detected language first, and write nothing until answered
- [x] 1.5 Embed the summary skeleton inline, with its section set and the roughly-one-screen cap, and state that the chosen language applies to headings too
- [x] 1.6 Write the output step: overwrite `openspec/changes/<name>/summary.md`, write no other file, report path and language, and do not reproduce the summary in the response
- [x] 1.7 Write the guardrails: no verdict, no findings, no claim verification, at most one pointer to `openspec-review-change` on an inconsistency, and `--store <id>` kept sticky once selected

## 2. Verify the skill against its spec

- [x] 2.1 Walk each requirement in `specs/change-summary/spec.md` and confirm the SKILL.md carries an instruction that would satisfy it
- [x] 2.2 Confirm the installer discovers the new skill: `opsx-skills list` names `openspec-summarize-change` at both destinations
- [x] 2.3 Dry-run the skill's own openspec commands (`list --json`, `status --change … --json`) to confirm `Bash(openspec:*)` is the only shell access it needs

## 3. Documentation

- [x] 3.1 Reword the README intro list and the install section for two shipped skills instead of one review skill
- [x] 3.2 Document the summarize skill in the README: what it reads, what it refuses to read, the language question, and the single output path
- [x] 3.3 Update the repository-structure listing in the README to show both skill directories

## 4. Validate

- [x] 4.1 Run `openspec validate add-summarize-change-skill --strict` and confirm it passes
