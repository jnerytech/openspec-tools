---
name: openspec-summarize-change
description: >-
  Write a short orientation summary of one OpenSpec change to
  summary.md — what it does, why it exists, what it excludes, which
  capabilities it touches, and every design decision with the alternative it
  beat. Derived from proposal, design and specs only: never from tasks,
  progress, git or code, so the summary describes the change's intent rather
  than how far along it is. Always asks whether to write in English or pt-BR.
when_to_use: >-
  The user wants to get oriented in a change quickly instead of reading all of
  its artifacts, or wants that orientation saved as a file ("summarize this
  change", "what is this change about?", "give me a quick summary", "resumir
  essa change", "faz um resumo da change", "explica essa change rapidamente").
argument-hint: "[change-name]"
license: MIT
compatibility: Requires openspec CLI >= 1.8.
effort: low
allowed-tools:
  - Bash(openspec:*)
  - Read
  - Glob
  - Write
  - AskUserQuestion
metadata:
  author: openspec-tools
  version: "1.0"
---

Write one file: a summary of a single OpenSpec change, short enough to read
before opening the artifacts it describes.

Describe, do not judge. Do not verify claims, do not review, do not implement.

**Change requested:** `$ARGUMENTS` — empty means select it in Step 1.

## Live context

Captured at load time from the nearest OpenSpec root. Re-run any command if you
need fresher data or a store scope.

- Active changes: !`openspec list --json 2>/dev/null || echo '{"changes":[],"note":"openspec CLI unavailable in this directory"}'`
- Stores: !`openspec store list --json 2>/dev/null || echo '{"stores":[]}'`

## Scope rules

- One change per invocation. A second change means a second invocation — never
  summarize in batch.
- **Store**: if the user names a store, or the work lives in one, take its id
  from the store list above and append `--store <id>` to every openspec command
  for the rest of the invocation. Unscoped examples below are shorthand.
- Task counts and status appear in the change listing. They are there to locate
  the change; they never enter the summary.

---

## Step 1 — Select the change

If `$ARGUMENTS` names a change, confirm it appears among the active changes
above. If it does not, stop: name the change requested and list the ones that
exist. Write nothing.

If `$ARGUMENTS` is empty, present the active changes via **AskUserQuestion**,
one option per change. Ask even when only one change is active.

If the selected change lives under `archive/`, confirm that specific archived
change by name via **AskUserQuestion** before reading anything. Declining ends
the invocation with nothing read and nothing written.

Then resolve its paths:

```
openspec status --change "<name>" --json
```

Use `changeRoot` and `artifactPaths` from that output. Ignore its progress
fields.

## Step 2 — Read the intent artifacts, and only those

Read, skipping what is absent:

1. `proposal.md` — why the change exists, what it changes, what it excludes
2. `design.md` — the decisions and the alternatives they were chosen over
3. `specs/**/spec.md` — which capabilities are touched and what they require

**Never read** `tasks.md`, git history, or any source file. If you notice the
change is partially implemented, that fact does not belong in the summary.

## Step 3 — Detect the change's language

Judge the language of the **prose** only. Ignore fenced and inline code, paths,
identifiers, schema headings (`## ADDED Requirements`, `### Requirement:`,
`#### Scenario:`) and requirement keywords (`SHALL`, `WHEN`, `THEN`) — those are
English in every change and will report a pt-BR change as English if counted.

Precedence: `proposal.md` decides. Use `design.md` as tie-breaker when the
proposal is absent or too thin on prose, spec files last.

## Step 4 — Ask which language to write in

Always ask, via **AskUserQuestion**, with exactly two options: **English** and
**pt-BR**. Offer the language detected in Step 3 first, labelled as recommended.
Ask even when the change is already written in pt-BR.

Write nothing until the question is answered. If it is dismissed, stop.

The chosen language applies to the whole file, section headings included.

## Step 5 — Write the summary

Write to `<changeRoot>/summary.md`, overwriting any previous one — read it first
if it exists so the write succeeds. This is the only file this skill writes.

The filename never varies with the language: a pt-BR summary is still
`summary.md`, never `resumo.md`. The content is translated, the path is not — so
anything referring to a change's summary can refer to one path.

Skeleton (translate the headings when writing pt-BR):

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

Rules for the content:

- **Compress, do not reproduce.** Never transcribe requirements or scenarios one
  by one; name each capability and characterize what it requires. Keep the whole
  file within roughly one screen — about 50 lines.
- **Every decision carries its rejected alternative.** A decision without it
  cannot tell the reader what was already considered.
- **No design document?** Say so: `No design decisions were recorded.` Never
  drop the section silently — that reads as "there were no decisions".
- **Keep the non-goals.** They survive compression; they are what stops the
  reader assuming scope that was already excluded.
- **No progress, no task counts, no implementation status**, in any section.

## Step 6 — Report the write

State the path written and the language used, and nothing more:

```
Wrote openspec/changes/<name>/summary.md (pt-BR)
```

Do not reproduce the summary in the response. The point of the file is that it
does not have to be read twice.

---

## Guardrails

- Exactly one file written, ever: the change's `summary.md`. No artifact of the
  change is created or modified.
- No verdict, no findings, no severity, no recommendations, no claim
  verification. If the artifacts contradict each other, add at most one line
  pointing to `openspec-review-change` and do not diagnose the contradiction.
- Never state or imply how far along the change is. The summary is about intent
  and shape; it stays correct as work proceeds precisely because state never
  entered it.
- Ask questions through AskUserQuestion, never as plain text in the response.
- Keep `--store <id>` sticky once selected.
