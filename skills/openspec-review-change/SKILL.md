---
name: openspec-review-change
description: >-
  Review an open OpenSpec change before it is applied or archived: cross-validate
  proposal, design, specs and tasks against each other, check alignment with the
  existing specs and with any code already written, and independently verify —
  against the real repository — every factual claim the change asserts. Produces
  review.md with a verdict and findings ranked by severity.
when_to_use: >-
  The user asks to review, audit, critique, double-check or sanity-check an
  OpenSpec change or proposal ("review this change", "is this proposal correct?",
  "check it before I apply", "revisar essa change", "revisar a proposta"), or
  wants a second opinion before openspec apply / openspec archive.
argument-hint: "[change-name]"
license: MIT
compatibility: Requires openspec CLI >= 1.8.
effort: high
allowed-tools:
  - Bash(openspec:*)
  - Bash(git log:*)
  - Bash(git show:*)
  - Bash(git diff:*)
  - Bash(git blame:*)
  - Bash(git status:*)
  - Read
  - Grep
  - Glob
  - Write
  - AskUserQuestion
metadata:
  author: openspec-tools
  version: "2.0"
---

Review one open (non-archived) OpenSpec change on two fronts:

- **Artifact quality** — are proposal, design, specs and tasks consistent, complete and testable?
- **Independent verification** — redo the investigation the change claims to have done and confirm, against the real repository, whether what it asserts is true.

Be a critical but constructive reviewer. Do not implement, do not design new features, do not fix code. Read, compare, verify, report.

**Change requested:** `$ARGUMENTS` — empty means select it in Step 1.

## Live context

Captured at load time from the nearest OpenSpec root. Re-run any command if you need fresher data or a store scope.

- Active changes: !`openspec list --json 2>/dev/null || echo '{"changes":[],"note":"openspec CLI unavailable in this directory"}'`
- Stores: !`openspec store list --json 2>/dev/null || echo '{"stores":[]}'`
- Working tree: !`git status --short 2>/dev/null | head -30 || true`
- Recent commits: !`git log --oneline -10 2>/dev/null || true`

## Scope rules

- One change per invocation. Never review in batch — a second change means a second invocation.
- Never review anything under `archive/` without explicit user confirmation.
- **Store**: if the user names a store, or the work lives in one, take its id from the store list above and append `--store <id>` to every openspec command (`list`, `status`, `show`, `validate`, `instructions`, `context`) for the rest of the review. Unscoped examples below are shorthand.
- Report language = the language the user is writing in.

---

## Step 1 — Select the change

If `$ARGUMENTS` names a change, confirm it appears among the active changes above. Otherwise present the active changes via **AskUserQuestion**, one option per change, each labelled with status and `completedTasks/totalTasks`. Confirm even when only one change is active.

Then load its state and announce `Reviewing change: <name>` (plus store id, when in use):

```
openspec status --change "<name>" --json
openspec instructions --json
```

## Step 2 — Validate with the CLI

```
openspec validate "<name>" --strict --json --no-interactive
```

Failures do not stop the review — each becomes a finding. Record errors and warnings verbatim.

## Step 3 — Read every artifact

Read all `.md` files in `openspec/changes/<name>/`, in this order (skip what is absent):

1. `proposal.md` — the *why*
2. `specs/**/spec.md` — the *what* (delta requirements and scenarios)
3. `design.md` — the *how* (legitimately absent for trivial changes)
4. `tasks.md` — the checklist and its completion state
5. Any other metadata/schema file (e.g. `.openspec.yaml`)

For each: note what it claims, and any gap, ambiguity or contradiction **inside** that artifact.

## Step 4 — Extract the verifiable claims

List everything the change asserts **as already true** about the repository — diagnoses, root causes, current behaviour, dependencies, configuration state, paths, names, versions, quoted output. Proposals are not claims; assertions about the present are.

A claim too vague to verify is itself a finding: an unverifiable proposal.

## Step 5 — Verify the claims independently

Treat every claim as a **hypothesis to refute**, not a fact. Open the cited files and check the claimed mechanism actually holds — existence of a file proves nothing. Actively hunt for scope the change missed ("only X is affected" → grep for siblings of X); missed scope is the highest-value finding a review produces.

Fan out: send **one `Explore` subagent per claim cluster, all in a single message** so they run concurrently, and keep only their verdicts in context. Prompt templates, evidence standards per claim type, and the verdict rules are in [references/claim-verification.md](references/claim-verification.md) — read it before delegating.

Each claim ends as **CONFIRMED** (with `file:line` or command output), **REFUTED** (with what is actually true), or **UNVERIFIABLE** (with why). No evidence → never CONFIRMED.

## Step 6 — Cross-validate the artifacts

| Check | Look for |
|---|---|
| Proposal → Specs | Do specs cover everything the proposal promises? Any requirement contradicting the stated scope? |
| Specs → Design | Does the design address every specified requirement? Assumptions not grounded in the specs? |
| Design → Tasks | Is every design decision reflected in tasks? Any task with no design backing? |
| Proposal → Tasks | Does the task list match the proposal's scope — nothing silently added or dropped? |

Each inconsistency gets a location (artifact + section), what was expected, what was found.

## Step 7 — Validate against existing specs, progress and code

- **Existing specs** (`openspec/specs/`): conflicts with current requirements, correct use of delta markers, scenario coverage and testability — conventions in [references/openspec-conventions.md](references/openspec-conventions.md).
- **Declared progress**: sample the `- [x]` tasks and confirm each corresponds to real code or git history. A checked box with no evidence is a finding.
- **Code conformance** (when partially implemented): does the code match specs and design? Are the specified edge cases and error paths handled? Any pattern contradicting a design decision? Report misalignment — never fix it.
- **Risk**: production, secrets, network or data touched? Risks mapped, rollback plan present, verification tasks included when warranted?

## Step 8 — Write and show the report (mandatory)

Read [references/report-template.md](references/report-template.md) for the skeleton, the verdict rubric and the severity definitions, then deliver the report in **both** places, in this order:

1. **File** — `openspec/changes/<name>/review.md`. Overwrite any previous one (git keeps history); if it exists, read it first so the write succeeds. This is the only file this skill writes.
2. **Response** — the full report as the text of your answer, before any question.

## Step 9 — Offer the next step

Only after both of the above, ask via **AskUserQuestion**: apply the suggested fixes to the artifacts, review another change (new invocation), or finish. Edit artifacts only if the user picks the first.

---

## Guardrails

- Read-only until the user authorizes fixes in Step 9. The single write exception is `review.md`. Verification uses inspection commands only — never anything that mutates code, infra or running services.
- The turn cannot end before the report is both written to `review.md` and shown as text. Ending straight into a question, with no visible report, is a failure of the skill.
- Never mark a claim CONFIRMED without concrete evidence. When in doubt: UNVERIFIABLE.
- Report what is written versus what is expected — never speculate about intent.
- Keep `--store <id>` sticky once selected.
- Unsure about an OpenSpec convention? Compare against archived changes in the same root rather than inventing a rule.
- Ask questions through AskUserQuestion, never as plain text in the response.
