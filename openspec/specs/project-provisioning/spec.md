# project-provisioning Specification

## Purpose
Defines how the package provisions a repository with everything it offers: what
must already be true before provisioning may happen, what a provisionable
component is, how each component's current state is presented as one editable
selection, and how every write and deletion is named and confirmed before it
takes place.
## Requirements
### Requirement: Provisioning requires an existing OpenSpec project

Provisioning SHALL proceed only when an `openspec/` directory owns the resolved
project root. When it does not, the command SHALL report that the directory was
not found, SHALL name the command that creates it, SHALL exit with code 1, and
SHALL write nothing. Provisioning SHALL NOT create an `openspec/` directory, and
SHALL NOT fall back to any other definition of a project: a repository root that
does not own `openspec/` is not a valid target, because everything provisioned
is inert without OpenSpec.

#### Scenario: An OpenSpec project is provisioned

- **WHEN** the user runs the provisioning command from a directory whose resolved root owns `openspec/`
- **THEN** provisioning proceeds

#### Scenario: A repository without OpenSpec is refused

- **WHEN** the user runs the provisioning command in a git repository that has no `openspec/` directory
- **THEN** the command reports that no OpenSpec project was found, exits with code 1, and writes nothing
- **AND** the report names `openspec init` as the command that creates one
- **AND** no `openspec/` directory is created

#### Scenario: The precondition is checked before anything is asked

- **WHEN** the precondition fails
- **THEN** the failure is reported without first prompting the user for any selection

#### Scenario: The project is resolved the same way as for reading

- **WHEN** the provisioning command is run from a subdirectory of the project
- **THEN** the resolved project root is the same one the reader derives its port from
- **AND** the outcome does not depend on which subdirectory the command was run from

### Requirement: Provisioning presents every component with its current state

Provisioning SHALL present every component the package offers as one selection,
each shown with its current state in the project, before anything is written.
A component SHALL be presented whether or not it is currently provisioned, so
the selection is a complete account of what the package offers rather than only
of what is missing.

#### Scenario: Every component is listed

- **WHEN** the selection is presented
- **THEN** every component the package offers appears in it, each with its current state

#### Scenario: State is shown before any write

- **WHEN** the selection is presented
- **THEN** nothing has yet been written to or deleted from the project

#### Scenario: A provisioned component is shown as provisioned

- **WHEN** a component is already provisioned in the project
- **THEN** it is presented as provisioned rather than as available to add

### Requirement: Provisioning is a reconciliation, not an addition

The selection SHALL open with every currently provisioned component already
selected. Applying the selection SHALL provision each component that is selected
and absent, and SHALL remove each component that is deselected and present.
Confirming the selection unchanged SHALL change nothing. There SHALL be no
separate command required to undo provisioning.

#### Scenario: Deselecting a provisioned component removes it

- **WHEN** the user deselects a component that is currently provisioned and applies the selection
- **THEN** that component is removed from the project

#### Scenario: Applying an unchanged selection is a no-op

- **WHEN** the user confirms the selection without changing it
- **THEN** the command reports that there is nothing to change, and nothing is written or deleted

#### Scenario: Selecting an absent component provisions it

- **WHEN** the user selects a component that is absent and applies the selection
- **THEN** that component is provisioned

### Requirement: Every write and deletion is named before it happens

Before applying anything, the command SHALL present the complete set of changes
it would make and SHALL require confirmation. A change that creates or deletes a
whole file or directory SHALL be presented by its absolute path. A change that
modifies part of an existing file SHALL additionally be presented as a diff
showing the lines added and removed, because a path alone does not say what
happens to the rest of that file. Declining the confirmation SHALL leave the
project untouched.

#### Scenario: New files are named by path

- **WHEN** applying would create a file or directory
- **THEN** its absolute path is shown before the confirmation

#### Scenario: Deletions are named by path

- **WHEN** applying would delete a file or directory
- **THEN** its absolute path is shown before the confirmation

#### Scenario: An edit inside an existing file is shown as a diff

- **WHEN** applying would add or remove lines within a file that already exists and holds content the package did not write
- **THEN** the lines to be added and removed are shown before the confirmation
- **AND** the file's path alone is not presented as the whole description of the change

#### Scenario: Declining changes nothing

- **WHEN** the user declines the confirmation
- **THEN** nothing is written or deleted, and the command reports that

### Requirement: Provisioning targets this repository

Provisioning SHALL apply to the resolved project root. A component that has no
meaningful location outside a project SHALL be provisioned only there and SHALL
NOT be offered at any other destination. A component that does support a
user-level destination MAY offer it during provisioning, and when it does, the
destination SHALL be presented with its absolute path.

#### Scenario: A project-only component is not offered elsewhere

- **WHEN** a component's only meaningful location is the project
- **THEN** provisioning does not offer any other destination for it

#### Scenario: A user-level destination is offered with its path

- **WHEN** a component supports a user-level destination and provisioning offers it
- **THEN** the destination is presented with the absolute path that would be written

### Requirement: The packaged skills are provisioned as a single component

Provisioning SHALL treat the skills the package ships as one component covering
all of them, rather than as one component per skill. Selecting it SHALL
provision every packaged skill; deselecting it SHALL remove every packaged skill
the package installed. Provisioning SHALL NOT offer selection of individual
skills; that remains available through the dedicated skill-management surface,
which this requirement does not change.

#### Scenario: Selecting skills provisions all of them

- **WHEN** the user selects the skills component and applies the selection
- **THEN** every skill the package ships is installed at the chosen destination

#### Scenario: Individual skills are not offered here

- **WHEN** the selection is presented
- **THEN** individual skill names are not presented as separately selectable items

#### Scenario: The dedicated skill surface is unaffected

- **WHEN** the user invokes the skill-management surface directly
- **THEN** it behaves exactly as it did before, including selection of individual skills

### Requirement: A choice that cannot be asked is supplied by an option

Every choice provisioning would prompt for SHALL have an equivalent option.
When a required choice has not been supplied and input is not an interactive
terminal, the command SHALL report which choice is missing, SHALL name the
option that supplies it, SHALL exit with code 1, and SHALL write nothing. It
SHALL NOT assume a default for a choice the user did not make.

#### Scenario: Missing choice without a terminal is an error

- **WHEN** provisioning is run with input that is not a terminal and a required choice has not been supplied as an option
- **THEN** the command reports the missing choice, names the option that supplies it, exits with code 1, and writes nothing

#### Scenario: Supplied choices skip the prompts

- **WHEN** every required choice is supplied as an option
- **THEN** provisioning runs without prompting

#### Scenario: Confirmation can be answered in advance

- **WHEN** the option that answers confirmations affirmatively is supplied
- **THEN** the confirmation is not asked
- **AND** what is written or deleted is the same as it would have been had the confirmation been answered interactively

### Requirement: No outcome depends on another program

Provisioning SHALL determine everything it reports and everything it does from
the filesystem and from its own package alone. It SHALL NOT invoke another
command-line program, and SHALL NOT make any decision, state report, or exit
code depend on another program's output or exit status. In particular, the
presence of an OpenSpec project SHALL be established from the filesystem, and no
OpenSpec command SHALL be run before, during, or after provisioning.

#### Scenario: No third-party command is invoked

- **WHEN** provisioning runs to completion
- **THEN** no other command-line program has been invoked

#### Scenario: A missing OpenSpec executable does not change the outcome

- **WHEN** provisioning runs in a valid OpenSpec project and no `openspec` executable is on the user's `PATH`
- **THEN** provisioning behaves exactly as it would if the executable were present

#### Scenario: Refreshing OpenSpec is reported, not performed

- **WHEN** provisioning completes and a follow-up OpenSpec command would be useful to the user
- **THEN** that command is printed as a suggestion
- **AND** it is not executed

### Requirement: Exit codes distinguish success from failure to provision

Provisioning SHALL exit with code 0 when it completes, including when the user
declines the confirmation or selects nothing. It SHALL exit with code 1 when it
could not run: when the precondition is unmet, when a required choice could not
be asked and was not supplied, or when a write it had named could not be
completed.

#### Scenario: Completing successfully exits zero

- **WHEN** provisioning applies the selection successfully
- **THEN** the process exits with code 0

#### Scenario: Declining exits zero

- **WHEN** the user declines the confirmation or selects nothing
- **THEN** the process exits with code 0

#### Scenario: An unmet precondition exits one

- **WHEN** provisioning cannot run because no OpenSpec project was found
- **THEN** the process exits with code 1

#### Scenario: A failed write is reported and fails

- **WHEN** a change that was named in the confirmation cannot be completed
- **THEN** the failure names the path involved and the process exits with code 1
