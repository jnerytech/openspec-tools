# artifact-ordering Specification

## Purpose
Defines the sequence in which `opsx-tools read` presents the artifacts of a
single change: which artifacts hold a named position and in what order, where an
artifact the order does not name is placed, and how artifacts of equal rank are
kept in a sequence that does not vary between runs — so the reader always
recommends the same reading path, and reads a change in the order it is best
understood rather than the order it was written.
## Requirements
### Requirement: Artifacts are presented in a named reading order

The reader SHALL present a change's artifacts in this order: the summary, the
proposal, the change's spec files, the design, the tasks, and the review. The
order SHALL be the same for an open change and for an archived one, and the same
however the change was reached: served on its own as the reader's target, opened
from the list of open changes, or opened from the archive. An artifact the change
does not contain SHALL be passed over without affecting the relative order of the
artifacts that are present.

#### Scenario: A change carrying every artifact

- **WHEN** a change contains a summary, a proposal, one spec file, a design, a task list and a review
- **THEN** they are presented in that order

#### Scenario: The contract precedes the work

- **WHEN** a change contains both spec files and a task list
- **THEN** every spec file is presented before the task list, and before the design

#### Scenario: Orientation leads

- **WHEN** a change contains a summary
- **THEN** the summary is presented before every other artifact of that change

#### Scenario: Absent artifacts leave no gap

- **WHEN** a change contains only a proposal, one spec file and a task list
- **THEN** they are presented in that order, unaffected by the absence of the summary, the design and the review

#### Scenario: An archived change is ordered identically

- **WHEN** an archived change and an open change contain the same artifacts
- **THEN** both present those artifacts in the same order

#### Scenario: A change served on its own is ordered identically

- **WHEN** the reader is pointed at one change directly, rather than at the set of changes
- **THEN** that change's artifacts are presented in the same order as when the same change is opened from the list

#### Scenario: The reading order does not depend on the file system

- **WHEN** a change's artifacts are presented
- **THEN** their order is the named one, and not the order in which the change's directory is read

### Requirement: Artifacts outside the named order follow it

An artifact the named order does not cover SHALL be presented after every
artifact the named order covers. Such an artifact SHALL NOT be presented
between two named artifacts, and its presence SHALL NOT change the order of the
named ones. Its presence SHALL NOT cause the change or any of its artifacts to
be omitted.

#### Scenario: An unrecognised artifact is presented last

- **WHEN** a change contains a proposal, a task list and a Markdown file the named order does not cover
- **THEN** the proposal and the task list are presented first, in that order, and the uncovered file follows them

#### Scenario: Named artifacts are not separated

- **WHEN** a change contains an artifact the named order does not cover
- **THEN** no named artifact is separated from another named artifact by it

### Requirement: Artifacts of equal rank are ordered stably

Artifacts holding the same rank — several spec files, or several artifacts the
named order does not cover — SHALL be presented in a stable order that does not
vary between runs over an unchanged change, and does not depend on the order in
which the change's directory happens to be read. Two changes whose artifacts are
laid out identically SHALL present them in the same sequence.

#### Scenario: Repeated reads agree

- **WHEN** a change containing several spec files is read twice without being modified
- **THEN** its spec files are presented in the same sequence both times

#### Scenario: Directory read order does not decide the sequence

- **WHEN** two changes hold spec files for the same capabilities and their directories are read in different orders
- **THEN** both changes present those spec files in the same sequence

#### Scenario: Uncovered artifacts are stable among themselves

- **WHEN** a change contains several Markdown files the named order does not cover
- **THEN** those files are presented in a sequence that does not vary between runs over the unchanged change
