---
name: openspec-review-change
description: >
  Review an open OpenSpec change: verify internal consistency of its artifacts,
  alignment with existing specs, conformance of any code already written, and
  independently confirm — in the real repository — the factual claims the change
  makes. Use when the user wants a change reviewed before applying or archiving.
license: MIT
compatibility: Requires openspec CLI.
---

Review an open (non-archived) OpenSpec change. The review has two fronts:

- **(a) Artifact quality** — are proposal, design, specs and tasks consistent, complete and testable?
- **(b) Independent exploration** — redo the investigation the change claims to have done and confirm, against the real code, whether what it asserts is true.

You are a critical but constructive reviewer. Do not implement anything, do not propose new features. Read, compare, verify, report.

**Read-only**: the only file this skill may write is the change's own `review.md` (Step 8). Everything else stays untouched unless the user explicitly asks for fixes afterwards.

**Store selection:** If the user names a store (a store is a standalone OpenSpec repo registered on this machine) or the work lives in one, run `openspec store list --json` to discover registered store ids, then pass `--store <id>` on every command that reads specs and changes (`list`, `status`, `show`, `validate`, `instructions`, `context`). Once selected, treat `--store <id>` as sticky for the rest of the review — every unscoped example below is shorthand. Without a store, commands act on the nearest local `openspec/` root.

**Input**: Optionally a change name (e.g. `/opsx:review add-auth`). If omitted, list the active changes and ask which one to review. **One change per invocation** — never review in batch. If the user wants another, they invoke the skill again.

---

## Step 1 — Select the change and load project state

```
openspec list --json
openspec status --change "<name>" --json
openspec instructions --json
```

- If a name was given, confirm it exists among the active changes.
- If not, present the active changes via **AskUserQuestion**, one option per change, each described with progress (`completedTasks/totalTasks`) and status.
- Even when there is only one active change, confirm it via AskUserQuestion — the user may have a different one in mind.
- Never review a change from `archive/`. If the user names an archived one, say so and ask for explicit confirmation before proceeding.

Always announce: `Reviewing change: <name>` (plus the store id, when one is in use).

Identify where the change lives (`openspec/changes/<name>/`) and which artifacts exist.

---

## Step 2 — Validate with the CLI

```
openspec validate "<name>" --strict --json --no-interactive
```

Record errors and warnings for the report. A validation failure does not stop the review — it becomes a finding.

---

## Step 3 — Read the change artifacts

Read every `.md` file inside `openspec/changes/<name>/`, in this order (skip if absent):

1. `proposal.md` — the *why*: motivation, scope, impact, decisions
2. `specs/**/spec.md` — the *what*: delta requirements and scenarios
3. `design.md` — the *how*: technical approach, architecture, data model (may legitimately be absent for trivial changes)
4. `tasks.md` — the *checklist*: implementation steps and completion status
5. Any other `.md` or change metadata/schema file (e.g. `.openspec.yaml`)

For each artifact, note what it claims to do and any gap, ambiguity or contradiction **within** that artifact.

---

## Step 4 — Extract the verifiable claims

Before exploring, build an explicit list of everything the change **asserts as fact** about the current state of the repository — not what it proposes, but what it says is already true. Typical claims:

- "File / module / service X is configured like this…"
- "The bug is caused by Y"
- "Component A currently depends on B"
- "The current behaviour is Z"
- Diagnoses, quoted command output, versions, paths, variable/function/service names

Each claim becomes an item to confirm in the next step. A claim too vague to verify is itself a quality finding: an unverifiable proposal.

---

## Step 5 — Independent exploration: confirm the claims

Treat every claim as a **hypothesis, not a fact**. Redo the investigation yourself, without trusting the change's conclusions.

- **Code**: open the cited files, confirm they exist, that the content is what is described, and that the claimed mechanism (dependency, flow, root cause) actually holds when you read the code — not merely that the file exists.
- **Configuration / infra**: when the change asserts configuration state (inventories, variables, templates, manifests, compose files), check the source files. If the claim is about **running** state (service up, port open, installed version) and there is safe read-only access, verify it; otherwise record it as "not verifiable in this environment" — never mark it confirmed without evidence.
- **History**: when the change cites past behaviour or the origin of a problem, corroborate with `git log` / `git blame` where it makes sense.
- **Coverage**: the change says "only X is affected"? Actively look for other affected sites (grep for related patterns). A missed piece of scope is one of the most valuable findings a review produces.

For large repositories, delegate broad searches to exploration subagents (e.g. the `Explore` agent) and keep only the conclusions in the main context.

Record each claim with a verdict: **CONFIRMED** (with evidence: `file:line`, command run, output), **REFUTED** (with the evidence of what is actually true), or **UNVERIFIABLE** (and why). A refuted claim is a critical finding; an unverifiable claim that is essential to the change's argument is an important one.

---

## Step 6 — Cross-validate the artifacts

Check consistency **between** artifacts:

| Check | What to look for |
|---|---|
| Proposal → Specs | Do the specs cover everything the proposal promises? Any requirement contradicting the stated scope? |
| Specs → Design | Does the design address all specified requirements? Does it introduce assumptions not grounded in the specs? |
| Design → Tasks | Are all design decisions reflected in tasks? Any task with no design backing? |
| Proposal → Tasks | Does the task list match the proposal's scope? Nothing added silently, nothing dropped? |

Report each inconsistency with **location** (artifact + section), **what was expected**, **what was found**.

---

## Step 7 — Validate against existing specs and code

**Existing specs** — read `openspec/specs/` (if present). For each spec file relevant to this change:

- Does the change respect the existing requirements, constraints and conventions?
- Are delta markers (`## ADDED`, `## MODIFIED`, `## REMOVED`, `## RENAMED`) used correctly, or does the change silently overwrite existing requirements?
- Does every requirement carry at least one `#### Scenario:`, and are those scenarios testable rather than vague?
- Are there conflicts between what the change proposes and what the existing specs define?

**Declared progress** — if `tasks.md` has `- [x]` items, sample them and confirm the checked tasks correspond to real changes in the code or git history. A checked box with no evidence in the repo is a finding.

**Code conformance** — if the change is partially or fully implemented, locate the relevant source files (use the tasks checklist and design as guides) and check:

- Does the code match what the specs and design describe?
- Are edge cases and error scenarios defined in the specs handled?
- Are there code patterns that contradict the design decisions?

**Do not rewrite or fix code.** Only report what is misaligned and where.

**Risk and impact** — does the change touch sensitive ground (production, secrets, network, data)? Are the risks mapped? Is there a rollback plan, and verification/rollback tasks, when the change warrants them?

---

## Step 8 — Write and display the report (mandatory — never skip)

The report is the product of the review and must exist in **two places**, in this order:

1. **File**: write `openspec/changes/<name>/review.md`, opening with a header line `> Reviewed on <date> — <verdict>`. Overwrite any previous `review.md` (git keeps the history). This is the only file this skill may write.
2. **Response**: display the full report as the text of your answer, **before** any AskUserQuestion. The next-step question never replaces the report — a review that ends only with a question, without a visible report and a written file, is incomplete.

Write the report in the language the user is speaking.

```markdown
# Review — <change-name>

**Status:** <status> — <N>/<M> tasks
**CLI validation:** ok | failed — <error summary>

## Verdict
<Approved | Approved with reservations | Needs rework> — <one sentence of justification>

## Claim verification
| Claim | Verdict | Evidence |
|---|---|---|
| <what the change asserts> | CONFIRMED / REFUTED / UNVERIFIABLE | <file:line, command, or reason> |

## Findings

### Critical (block apply/archive)
- <file>: <finding and why it matters>

### Important (should be fixed)
- <finding>

### Suggestions (optional)
- <finding>

## What looks good
- <item>
```

Omit a section when it has no entries. Every finding points at the file (and the relevant excerpt when useful) and explains the practical consequence, not just the rule that was broken. Be precise and concise; do not speculate about intent — report what is written versus what is expected.

---

## Step 9 — Offer the next step

Only after the report is written to `review.md` **and** displayed in the response, ask via **AskUserQuestion** whether the user wants to:

- Apply the suggested fixes to the artifacts
- Review another change (new invocation of the skill)
- Finish

Only edit artifacts if the user chooses to apply the fixes.

---

## Guardrails

- The review is read-only until the user authorizes fixes — the single write exception is `review.md` in Step 8. Independent exploration uses read/inspect commands only; never anything that mutates code or infrastructure.
- The turn cannot end before the full report has been written to `review.md` and shown as text in the response. Ending straight into a question, with no visible report, is a failure of the skill.
- Never mark a claim confirmed without concrete evidence (`file:line` or command output). When in doubt, it is UNVERIFIABLE.
- One change per invocation — never review in batch.
- Never review changes under `archive/` without explicit user confirmation.
- Always run `openspec` against the correct root; keep `--store <id>` sticky once selected.
- Do not invent format rules: when unsure about an OpenSpec convention, compare against archived changes in the same root as reference.
- Ask the user questions through the native interactive tool (AskUserQuestion), never as plain text in the response.
