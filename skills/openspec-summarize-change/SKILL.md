---
name: openspec-summarize-change
description: >-
  Write a short orientation summary of one OpenSpec change to summary.md — what
  it does, why it exists, what it excludes, which capabilities it touches, and
  every design decision with the alternative it beat. Derived from proposal,
  design and specs only: never from tasks, progress, git or code, so the summary
  describes the change's intent rather than how far along it is. The user always
  chooses English or pt-BR before anything is written.
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
  version: "1.1"
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
- Task counts and status in the change listing are there to locate the change.
  They never enter the summary.

---

## Step 1 — Select the change

If `$ARGUMENTS` names a change, confirm it appears among the active changes
above. If it does not, stop: name the change requested, list the ones that
exist, write nothing.

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

**Never read** `tasks.md`, git history, or any source file. A change that is
visibly half-implemented is summarized exactly like one that is untouched.

## Step 3 — Detect the change's language

Judge the language of the **prose** only. Ignore fenced and inline code, paths,
identifiers, schema headings (`## ADDED Requirements`, `### Requirement:`,
`#### Scenario:`) and requirement keywords (`SHALL`, `WHEN`, `THEN`) — those are
English in every change and will report a pt-BR change as English if counted.

Precedence: `proposal.md` decides; `design.md` breaks the tie when the proposal
is absent or thin on prose; spec files last.

## Step 4 — Ask which language to write in

Always ask, via **AskUserQuestion**, with exactly two options: **English** and
**pt-BR**. Offer the language detected in Step 3 first, labelled as recommended.
Ask even when the change is already written in pt-BR.

Write nothing until the question is answered. If it is dismissed, stop.

The chosen language applies to the whole file, section headings included.

## Step 5 — Write the summary

Read [references/summary-template.md](references/summary-template.md) for the
skeleton and the content rules, then write `<changeRoot>/summary.md` — reading
any existing one first so the write succeeds. This is the only file this skill
writes, and it is overwritten, never versioned alongside.

The filename never varies with the language: a pt-BR summary is still
`summary.md`, never `resumo.md`.

## Step 6 — Report the write

State the path written and the language used, and nothing more:

```
Wrote openspec/changes/<name>/summary.md (pt-BR)
```

Do not reproduce the summary in the response — the file exists so it does not
have to be read twice.

---

## Guardrails

- Exactly one file written, ever: the change's `summary.md`. No artifact of the
  change is created or modified.
- No verdict, no findings, no severity, no recommendations, no claim
  verification — those belong to `openspec-review-change`.
- Never state or imply how far along the change is. The summary covers intent
  and shape, and stays correct as work proceeds precisely because state never
  entered it.
- Ask questions through AskUserQuestion, never as plain text in the response.
- Keep `--store <id>` sticky once selected.
