## ADDED Requirements

### Requirement: Including archived changes is an explicit option

The CLI SHALL provide an option that includes archived changes in the reader. The option SHALL be listed in the usage output alongside every other supported option. Archived changes SHALL be excluded unless that option is supplied or an archived change is named as a target; there SHALL be no invocation in which archived changes appear without the user having asked for them.

#### Scenario: Option is documented

- **WHEN** the user runs `opsx-read --help`
- **THEN** the usage output lists the option that includes archived changes

#### Scenario: Option is recognized, not treated as a target

- **WHEN** the user supplies the option that includes archived changes
- **THEN** the CLI starts the reader with archived changes included
- **AND** the option is not reported as an unresolvable target

#### Scenario: Archived changes are excluded by default

- **WHEN** the user runs `opsx-read` without that option and without naming an archived change
- **THEN** the reader is started with archived changes excluded

### Requirement: An archived change can be given as a target

The CLI SHALL resolve an archived change named as a target, whether the user types the archived directory name including its date prefix or the display name without it. Naming an archived change SHALL be sufficient to read it; the option that includes archived changes SHALL NOT additionally be required. If the name matches both an open change and an archived change, the open change SHALL win, and the CLI SHALL report that an archived change of the same name also exists.

#### Scenario: Archived change resolved by directory name

- **WHEN** the user runs `opsx-read 2026-08-10-improve-cli-error-guidance` and that directory exists under the archive
- **THEN** the CLI serves that archived change

#### Scenario: Archived change resolved by display name

- **WHEN** the user runs `opsx-read improve-cli-error-guidance`, no open change has that name, and an archived change has that display name
- **THEN** the CLI serves that archived change

#### Scenario: Open change wins a name conflict

- **WHEN** the target names both an open change and an archived change
- **THEN** the CLI serves the open change
- **AND** the CLI reports that an archived change of the same name exists

## MODIFIED Requirements

### Requirement: Target resolution failure reports every location tried

When a target cannot be resolved, the CLI SHALL report the target as the user typed it and SHALL list every filesystem location it attempted, including the path relative to the working directory, the path under the changes directory, and the path under the archive directory. Reporting only one attempted location is not sufficient.

#### Scenario: Unresolvable target lists both attempts

- **WHEN** the user runs `opsx-read teste` and none of `./teste`, `./openspec/changes/teste`, or `./openspec/changes/archive/teste` exists
- **THEN** the error names `teste` as the requested target
- **AND** the error lists all three of those locations as locations that were tried
- **AND** the process exits with code 1

### Requirement: Target failure surfaces the available open changes

When a target cannot be resolved, the CLI SHALL help the user find the right name. If open changes exist, the error SHALL list their names, calling out any that closely resemble the requested target. If no open changes exist, the error SHALL state that plainly rather than listing nothing. The CLI SHALL also consider archived change names when looking for a close match, and SHALL identify any archived suggestion as archived so it is not mistaken for open work.

#### Scenario: Close match is suggested

- **WHEN** the target cannot be resolved and an open change name closely resembles it
- **THEN** the error presents that change name as a suggestion

#### Scenario: Available changes are listed when no close match exists

- **WHEN** the target cannot be resolved, open changes exist, and none closely resembles the target
- **THEN** the error lists the available open change names

#### Scenario: Empty change set is stated

- **WHEN** the target cannot be resolved and no open changes exist
- **THEN** the error states that there are no open changes, rather than presenting an empty list

#### Scenario: Archived name is suggested and marked

- **WHEN** the target cannot be resolved and an archived change name closely resembles it
- **THEN** the error presents that name as a suggestion
- **AND** the suggestion is identified as an archived change

### Requirement: Absence of open changes is explained but still served

When invoked with no target, the CLI SHALL start the server even if there are no open changes to display, so that the user can create a change and reload the page. Before starting, it SHALL report which directory was read and state that it contained no open changes. A directory holding only `archive/` SHALL count as containing no open changes, and in that case the report SHALL name the option that displays the archived changes. Reporting that option SHALL NOT cause archived changes to be displayed.

#### Scenario: Empty changes directory still serves

- **WHEN** the user runs `opsx-read` with no target and `openspec/changes/` contains no open changes
- **THEN** the CLI reports the directory it read and states that no open changes were found
- **AND** the server starts and the process does not exit

#### Scenario: Archive-only directory counts as empty

- **WHEN** `openspec/changes/` contains only an `archive/` directory
- **THEN** the CLI reports that no open changes were found
- **AND** the report names the option that displays the archived changes
- **AND** the archived changes are not displayed

#### Scenario: Missing changes directory is reported

- **WHEN** the user runs `opsx-read` with no target and `openspec/changes/` does not exist
- **THEN** the CLI reports that the directory was not found and directs the user to `opsx-read --help`
- **AND** the server still starts
