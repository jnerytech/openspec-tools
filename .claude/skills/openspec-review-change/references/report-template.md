# Report template

Read at Step 8. Write the report in the language the user is writing in.

## Verdict rubric

| Verdict | When |
|---|---|
| **Approved** | No critical findings, no refuted claim, artifacts consistent, `--strict` validation clean. |
| **Approved with reservations** | Only important/suggestion-level findings — the change is sound but leaves gaps a reader can close without redesigning it. |
| **Needs rework** | Any refuted claim the change depends on, any contradiction between artifacts, missed scope, or a strict-validation error. |

## Severity definitions

- **Critical** — blocks apply/archive: false premise, contradiction between artifacts, missed scope, unhandled requirement, checked task with no evidence in the repo.
- **Important** — should be fixed before archiving: untestable scenario, missing rollback for a risky change, design decision absent from the tasks, essential claim left unverifiable.
- **Suggestion** — optional: wording, structure, redundancy, nice-to-have coverage.

## Skeleton

```markdown
> Reviewed on <date> — <verdict>

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
- <file:line>: <what is wrong> → <practical consequence>

### Important (should be fixed)
- <file:line>: <what is wrong> → <practical consequence>

### Suggestions (optional)
- <finding>

## What looks good
- <item>
```

Omit any section with no entries. Keep `What looks good` — it tells the author what not to touch.

## Finding quality

Every finding: **where** (file, and section for artifacts), **what** was expected versus found, **why it matters** in practice.

- Weak — `tasks.md: task 3 is vague.`
- Strong — `tasks.md:14 — task 3 ("update the server") names no file, while design.md:22 requires the change in both server.ts and port.ts. Whoever implements it will miss the port derivation and the feature will half-ship.`

Report the text against the expectation. Never speculate about the author's intent.
