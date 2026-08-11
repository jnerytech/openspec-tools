# Summary template

Loaded at write time. The skeleton below is the shape of `summary.md`; the rules
under it decide what goes in each section.

## Skeleton

Translate the headings when writing pt-BR; keep the section order.

```markdown
# <change-name>

**In one sentence:** <what the change does>

## Why
2–4 lines. The problem, not the solution.

## What changes
- the scope, in bullets

**Out of scope:** <the proposal's non-goals>

## Capabilities affected
- `<capability-path>` — <what it requires, characterized in one line>

## Key decisions
- **<the choice>** — chosen over <the alternative>, because <the reason>.

## Where to dig deeper
`proposal.md` · `design.md` · `specs/<capability-path>/spec.md`
```

## Content rules

- **Compress, do not reproduce.** Never transcribe requirements or scenarios one
  by one; name each capability and characterize what it requires. Keep the whole
  file within roughly one screen — about 50 lines.
- **Every decision carries the alternative it beat.** Without it the reader
  cannot tell what was already considered.
- **No design document?** Write `No design decisions were recorded.` under
  **Key decisions**. Never drop the section — a missing section reads as "there
  were no decisions".
- **Keep the non-goals.** They survive compression; they are what stops the
  reader assuming scope that was already excluded.
- **Name only the artifacts that exist** under **Where to dig deeper**, with one
  entry per spec file.
- **No progress, no task counts, no implementation status**, in any section.
- **No verdict, no findings, no recommendations.** If the artifacts contradict
  each other, add at most one line pointing to `openspec-review-change`, and do
  not diagnose the contradiction.
