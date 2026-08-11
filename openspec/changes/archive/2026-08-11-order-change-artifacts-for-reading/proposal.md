## Why

`opsx-tools read` exists to orient someone on a change they did not write. The
order it presents artifacts in is therefore not cosmetic: it is the reading
path the tool recommends. Today that path is wrong in two ways, and no spec
defends it.

The reader ranks artifacts by an ordered list in `src/scanner.ts`, and anything
absent from that list sinks to the bottom. Two consequences follow:

- The list names `specs`, but a delta spec file is `specs/<capability>/spec.md`,
  whose artifact name is `spec`. The entry never matches. Delta specs sink to
  the bottom, so a change renders **proposal → design → tasks → spec**: the
  contract arrives after the task list, and the reader recommends "what to do"
  before "what this is".
- `summary.md` — the orientation artifact the `change-summary` capability
  produces precisely so that a reader can get their bearings — is unknown to
  the list. It sinks to the bottom too, landing the one artifact written for
  orientation in the least prominent position on the page.

Both are invisible from the outside: the reader shows *an* order, and nothing
signals that it is not the intended one. No capability states what the order
should be, so nothing catches the regression and nothing would catch the next.

## What Changes

- A new capability defines the order in which a change's artifacts are
  presented, for open and archived changes alike, so the order becomes
  specified behavior rather than an implementation detail.
- Artifacts are ordered **summary → proposal → spec files → design → tasks →
  review**, followed by any artifact the order does not name. The sequence
  follows how a change is read rather than how it is written: orientation
  first, then why, then the contract, then how, then the work, with review last
  as commentary on all of it.
- Delta spec files are recognised and placed at their intended rank, closing
  the `spec`/`specs` mismatch that puts the contract after the task list.
- `summary.md` and `review.md` are recognised by name, so neither depends on
  the unknown-artifact fallback for its position.
- Ties are broken deterministically. A change with several delta spec files, or
  with artifacts the order does not name, presents them in the same sequence on
  every run rather than in directory-read order — the guarantee archived
  changes already carry, extended to artifacts within a change.
- Artifact slugs are unchanged, so any link or anchor addressing an artifact
  keeps working across the reordering.
- **Not in scope**: any freshness signal on `summary.md`. A summary is derived
  from the proposal, the design and the spec files and can fall behind them
  once they are edited, and promoting it to first position makes a stale one
  more prominent. Detecting or displaying that staleness is a separate concern
  with its own design, and is deliberately left out so this change stays a
  question of order alone.
- **No design document**, deliberately. None of the conditions that call for one
  hold here: the work is one ordering rule applied at two call sites in a single
  module, it adds no dependency and touches no data model, and it carries no
  security, performance or migration concern. The one decision a design would
  record — the order itself — is settled above, and the only question left, that
  equal ranks resolve the same way on every run, is a requirement in the spec
  rather than a choice of approach. `openspec status` will therefore report the
  design as outstanding for the life of this change; it is skipped, not pending.

## Capabilities

### New Capabilities

- `artifact-ordering`: the sequence in which `opsx-tools read` presents the
  artifacts of a single change — which artifacts are named and at what rank,
  where unnamed artifacts go, and how equal ranks are broken so repeated runs
  over an unchanged change agree.

### Modified Capabilities

None. `archive-browsing` governs the ordering of archived changes relative to
one another and is unaffected by the order of artifacts within any one of them.

## Impact

- `src/scanner.ts`: the artifact order list and its sort key, applied at both
  call sites that sort artifacts (`scanChanges` and `scanArchivedChanges`), so
  open and archived changes order identically.
- The rendered output of every change, open and archived. No invocation, no
  option and no slug changes, so nothing outside the reader's own page order is
  affected.
- Changes that carry no `summary.md` or `review.md` see only the delta specs
  move, from last to their place ahead of `design.md`.
