# archive-browsing Specification

## Purpose
Defines how `opsx-read` treats archived changes: when they may be displayed at all, how each one is identified and dated from the archive directory, how they are ordered and kept distinct from open changes, and how an archived change is addressed and labelled so completed work is never mistaken for pending work.
## Requirements
### Requirement: Archived changes are displayed only when requested

The reader SHALL NOT display archived changes unless the user asks for them, either by supplying the option that includes them or by naming one as a target. The absence of open changes SHALL NOT cause archived changes to be displayed. Archived changes SHALL NOT be counted among the open changes.

#### Scenario: Default invocation hides the archive

- **WHEN** the user runs `opsx-read` with no target and without the option that includes archived changes
- **THEN** no archived change appears in the reader

#### Scenario: An empty open set does not reveal the archive

- **WHEN** `openspec/changes/` contains only an `archive/` directory and the user has not asked for archived changes
- **THEN** the reader displays no changes rather than falling back to the archived ones

#### Scenario: Requested archived changes are displayed

- **WHEN** the user asks for archived changes to be included
- **THEN** every archived change is available to read

### Requirement: Each archived directory is one archived change

Each immediate subdirectory of the archive directory that contains at least one Markdown file SHALL be treated as exactly one archived change, with its own artifacts. Artifacts belonging to different archived changes SHALL NOT be merged into a single change. A subdirectory containing no Markdown file SHALL NOT be listed.

#### Scenario: Archived directories are listed individually

- **WHEN** the archive directory contains two archived change directories
- **THEN** the reader lists two archived changes, each with only its own artifacts

#### Scenario: Nested artifacts stay with their change

- **WHEN** an archived change contains Markdown files in subdirectories, such as its specs
- **THEN** those files are listed as artifacts of that archived change and of no other

#### Scenario: Directory without Markdown is skipped

- **WHEN** a subdirectory of the archive directory contains no Markdown file
- **THEN** it is not listed as an archived change

### Requirement: Archive date is derived from the directory name

An archived change directory named with a leading `YYYY-MM-DD-` prefix SHALL be reported with that date as its archive date and with the remainder of the name as its display name. A directory without such a prefix SHALL still be listed, using the whole directory name as its display name and reporting no archive date. A malformed prefix SHALL NOT cause the archived change to be omitted or the reader to fail.

#### Scenario: Dated directory yields date and name

- **WHEN** an archived change directory is named `2026-08-10-improve-cli-error-guidance`
- **THEN** its archive date is 2026-08-10 and its display name is `improve-cli-error-guidance`

#### Scenario: Undated directory is still listed

- **WHEN** an archived change directory has no date prefix
- **THEN** it is listed using its full directory name and no archive date is shown

#### Scenario: Archive date is visible

- **WHEN** a dated archived change is listed
- **THEN** its archive date is shown alongside it

### Requirement: Archived changes are ordered most recent first

Archived changes SHALL be ordered by archive date, most recent first. Archived changes without a date SHALL be ordered after all dated ones, in a stable order that does not vary between runs over an unchanged archive directory.

#### Scenario: Newest archived change appears first

- **WHEN** archived changes dated 2026-08-10 and 2026-01-05 are listed
- **THEN** the 2026-08-10 change is listed before the 2026-01-05 change

#### Scenario: Undated archived changes come last

- **WHEN** the archive contains both dated and undated archived changes
- **THEN** every dated change is listed before every undated one

#### Scenario: Ordering is stable

- **WHEN** the same archive directory is listed twice without changing
- **THEN** the order is identical both times

### Requirement: Archived changes are presented apart from open changes

When archived changes are displayed alongside open changes, they SHALL appear in their own labelled group, distinct from the open changes and never interleaved with them. The open changes' own listing and ordering SHALL be unaffected by whether archived changes are displayed. When archived changes are requested and none exist, the reader SHALL state that rather than showing an unexplained empty group.

#### Scenario: Archived group is separate and labelled

- **WHEN** both open and archived changes are displayed
- **THEN** the archived changes appear under their own labelled group
- **AND** no archived change appears among the open changes

#### Scenario: Open listing is unchanged

- **WHEN** archived changes are displayed
- **THEN** the open changes are listed in the same order and with the same content as when archived changes are hidden

#### Scenario: Empty archive is stated

- **WHEN** archived changes are requested and the archive holds none
- **THEN** the reader states that there are no archived changes

### Requirement: An archived change is addressable without colliding with an open change

Every displayed archived change SHALL have its own address that is reachable from the listing and distinct from the address of any open change. An archived change and an open change whose display names are identical SHALL each resolve to their own content, and requesting one SHALL never yield the other.

#### Scenario: Identical names do not collide

- **WHEN** an open change and an archived change share the same display name and both are displayed
- **THEN** requesting the open change yields the open change's artifacts
- **AND** requesting the archived change yields the archived change's artifacts

#### Scenario: Listed archived change is reachable

- **WHEN** an archived change is listed
- **THEN** its address opens that archived change

#### Scenario: Unknown archived address is reported

- **WHEN** an address for an archived change that does not exist is requested
- **THEN** the reader reports that it was not found rather than serving another change

### Requirement: An archived change is labelled as archived when read

When an archived change is read, the reader SHALL mark it as archived and SHALL show its archive date when one is known, so that a completed task list is not read as outstanding work. An open change SHALL NOT carry that marking.

#### Scenario: Archived change carries the marking

- **WHEN** the user reads an archived change with a known archive date
- **THEN** the page identifies it as archived and shows that date

#### Scenario: Undated archived change is still marked

- **WHEN** the user reads an archived change with no known archive date
- **THEN** the page still identifies it as archived

#### Scenario: Open change is not marked

- **WHEN** the user reads an open change
- **THEN** the page carries no archived marking

### Requirement: Archived changes can be revealed and hidden without restarting

The reader SHALL let the user reveal and hide archived changes while it is running, without restarting the process. The invocation SHALL determine the initial state, and the running reader SHALL reflect the current state on each request.

#### Scenario: Revealing archived changes while running

- **WHEN** the reader was started without archived changes and the user reveals them
- **THEN** the archived changes are displayed without the process being restarted

#### Scenario: Hiding archived changes while running

- **WHEN** archived changes are displayed and the user hides them
- **THEN** only open changes are displayed

#### Scenario: Initial state follows the invocation

- **WHEN** the reader is started with the option that includes archived changes
- **THEN** archived changes are displayed on the first page load without further action

#### Scenario: Newly archived work appears on reload

- **WHEN** a change is archived while the reader is running and archived changes are displayed
- **THEN** reloading lists it among the archived changes

### Requirement: Targeting the archive directory lists its archived changes

When the archive directory itself is given as a target, the reader SHALL present it as a listing of the archived changes it contains. It SHALL NOT present the archive as a single change whose artifacts are the merged Markdown files of every archived change.

#### Scenario: Archive directory yields a listing

- **WHEN** the user targets `openspec/changes/archive`
- **THEN** the reader lists the archived changes it contains, each addressable on its own

#### Scenario: Artifacts are not merged

- **WHEN** the user targets the archive directory and it holds more than one archived change
- **THEN** the artifacts of different archived changes are not presented together as one change
