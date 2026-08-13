## MODIFIED Requirements

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
