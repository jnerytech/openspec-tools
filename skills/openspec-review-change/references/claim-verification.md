# Claim verification

Read at Step 5, before delegating.

## What counts as a claim

Anything the change asserts as **already true** about the repository or its environment:

- "Module X is configured like this…", "A depends on B", "the current behaviour is Z"
- Root causes and diagnoses ("the bug is caused by Y")
- Quoted command output, versions, ports, paths, file/function/service names
- Negative claims — "nothing else uses this", "only X is affected"

Not claims: what the change *proposes* to do, and value judgements.

## Stance

Try to **refute** each claim. Default to REFUTED or UNVERIFIABLE when the evidence is ambiguous; a review that confirms a false claim is worse than one that flags a true claim as unverified.

Existence proves nothing. The claim is about a *mechanism* (a dependency, a flow, a cause) — read the code until the mechanism either holds or breaks.

## Evidence standard by claim type

| Claim type | Accept as evidence | Never accept |
|---|---|---|
| Code / structure | `file:line` you read, with the relevant excerpt | the file exists; a plausible name |
| Dependency / data flow | the call chain traced across files, each hop cited | an import statement alone |
| Root cause | the code path that produces the symptom | a narrative that merely sounds consistent |
| Configuration | the source file (inventory, template, manifest, compose, env sample) | a comment or doc describing it |
| Running state (service up, port open, installed version) | read-only command output captured in this session | assumption — otherwise UNVERIFIABLE |
| History / origin | `git log` / `git blame` / `git show` output | the change's own retelling |
| Coverage ("only X") | a repo-wide grep for the pattern, listing every hit | the change's word |

## Parallel delegation

Group claims into clusters that share files or a subsystem. Send **all `Explore` subagents in one message** so they run concurrently; keep only their verdicts in the main context.

Prompt template, one per cluster:

```
Verify these claims against the repository at <root>. Try to REFUTE each one.

Claims:
1. <claim, quoted from the artifact it came from>
2. …

For each claim return exactly:
- verdict: CONFIRMED | REFUTED | UNVERIFIABLE
- evidence: file:line plus the decisive excerpt, or the command and its output
- if REFUTED: what is actually true, with the same evidence standard
- if UNVERIFIABLE: what is missing and what would settle it

Confirm only what you read directly. Existence of a file is not evidence of a
mechanism. Do not modify anything. Do not fix, suggest or design — report only.
```

Also give one subagent the coverage sweep: "the change says only X is affected — find every other site matching <pattern> and list them."

## Verdicts and severity

| Verdict | Meaning | Weight in the report |
|---|---|---|
| CONFIRMED | verified directly, evidence cited | supports the change |
| REFUTED | the repository contradicts it | **Critical** — the change rests on a false premise |
| UNVERIFIABLE | no safe way to check here | **Important** when the change's argument depends on it; otherwise a note |

Report every claim in the table, including confirmed ones — the confirmations are what make the refutations credible.
