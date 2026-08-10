---
name: openspec-review
description: >
  Review an open OpenSpec change: verify internal consistency of artifacts,
  alignment with existing specs, and conformance of any code already written.
version: 1.0.0
---

# OpenSpec Review

You are performing a **structured review** of an OpenSpec change. Your job is to act as a critical but constructive reviewer — not to implement anything, not to propose new features. Read, compare, and report.

---

## Step 1 — Load project state

Run the following and read the output carefully:

```
openspec status --json
openspec instructions --json
```

Identify:
- Which change is currently active (or ask the user to specify one if ambiguous)
- Where the change lives (`openspec/changes/<change-name>/`)
- Which artifacts exist in this change

---

## Step 2 — Read the change artifacts

Read every `.md` file inside the active change directory, in this order (skip if absent):

1. `proposal.md` — the *why*: motivation, scope, decisions
2. `specs/` (all files) — the *what*: requirements, scenarios, acceptance criteria
3. `design.md` — the *how*: technical approach, architecture, data model
4. `tasks.md` — the *checklist*: implementation steps and their completion status
5. Any other `.md` present

For each artifact, note:
- What it claims to do / define
- Any gaps, ambiguities, or contradictions you find **within** that artifact

---

## Step 3 — Cross-validate artifacts

Check for consistency **between** artifacts:

| Check | What to look for |
|---|---|
| Proposal → Specs | Do the specs cover everything the proposal promises? Are there requirements that contradict the stated scope? |
| Specs → Design | Does the design address all specified requirements? Does it introduce assumptions not grounded in the specs? |
| Design → Tasks | Are all design decisions reflected in tasks? Are there tasks with no design backing? |
| Proposal → Tasks | Does the task list match the scope described in the proposal? Nothing added silently, nothing dropped? |

Report each inconsistency with: **location** (artifact + section), **what was expected**, **what was found**.

---

## Step 4 — Validate against existing specs

Read the project's existing specs in `openspec/specs/` (if the directory exists).

For each existing spec file relevant to this change:
- Does the change respect the existing requirements, constraints, and conventions?
- Does the change introduce delta markers (`## ADDED`, `## MODIFIED`, `## REMOVED`) correctly, or does it silently overwrite existing requirements?
- Are there conflicts between what the change proposes and what the existing specs define?

---

## Step 5 — Review code conformance (if applicable)

If the change is partially or fully implemented, locate the relevant source files (use the tasks checklist and design as guides).

For each implemented area:
- Does the code match what the specs and design describe?
- Are edge cases or error scenarios defined in the specs handled in the code?
- Are there code patterns that contradict the design decisions?

**Do not rewrite or fix code.** Only report what is misaligned and where.

---

## Step 6 — Deliver the review report

Output a structured review report in this format:

```markdown
# Review Report — <change-name>

## Summary
<One paragraph: overall assessment. Is this change ready to apply? What is the main concern, if any?>

## ✅ What looks good
- <item>
- <item>

## ⚠️ Inconsistencies found
### <Artifact or area>
- **Issue:** <description>
  **Expected:** <what should be there>
  **Found:** <what is actually there>

## 🔴 Blocking issues (if any)
- <issue that must be fixed before `/opsx:apply`>

## 💡 Suggestions (non-blocking)
- <optional improvements>

## Verdict
- [ ] Ready to apply
- [ ] Needs minor fixes before applying
- [ ] Needs significant rework
```

Be precise and concise. Point to specific sections and line references where possible. Do not speculate about intent — only report what is written vs. what is expected.

---

## Notes

- If the user runs `/opsx:review <change-name>`, use that change instead of the active one.
- If no change is active and none is specified, list the open changes and ask which one to review.
- This skill does **not** modify any files. It is read-only.
