## Purpose

Defines how the skills this package ships are installed into and removed from a
user's AI tool: which skills are eligible, which destinations are offered, how
the state of an already-installed copy is determined, and how a destructive or
overwriting action is confirmed before it happens.

## ADDED Requirements

### Requirement: Only the packaged skills are eligible

The installer SHALL treat the skills directory of its own installed package as
the complete and only set of installable skills. It SHALL resolve that
directory from its own location on disk, not from the working directory, so
that a globally installed package and a working clone behave identically. A
skill directory present at a destination whose name does not appear in the
package SHALL NOT be listed, offered, or removed under any invocation.

#### Scenario: Source is the package, not the working directory

- **WHEN** the installer is run from a directory that is not the package
- **THEN** the skills it offers are those shipped inside the installed package
- **AND** the working directory is not searched for skills to install

#### Scenario: Unrelated installed skills are untouched

- **WHEN** a destination contains skill directories that the package does not ship
- **THEN** those directories are not listed, are not offered for removal, and are not modified

#### Scenario: No packaged skills

- **WHEN** the package ships no skills
- **THEN** the installer reports that there is nothing to install and exits with code 0

### Requirement: Two destinations are supported and named

The installer SHALL support exactly two destinations: the **project**, at
`.claude/skills/` under the resolved project root, and the **user**, at
`~/.claude/skills/`. Both SHALL be selectable in the same invocation. Every
destination SHALL be presented with its absolute path, so the user is never
asked to approve a write to a location they cannot see. The installer SHALL NOT
write to enterprise-managed settings or into an installed plugin's directory.

#### Scenario: Both destinations offered

- **WHEN** the user is asked where to install
- **THEN** the project and the user destinations are both offered
- **AND** each is shown with the absolute path that would be written

#### Scenario: Both destinations in one invocation

- **WHEN** the user selects both destinations
- **THEN** the skill is installed to both, and each result is reported separately

#### Scenario: Project root is resolved consistently

- **WHEN** the installer is run from a subdirectory of a project
- **THEN** the project destination resolves to the same project root the reader uses
- **AND** the destination does not depend on which subdirectory the command was run from

#### Scenario: Missing destination directory is created

- **WHEN** a selected destination's skills directory does not exist
- **THEN** it is created, and the installer reports that a new skills directory was created
- **AND** the report states that a skills directory that did not exist when the AI tool started is only detected after the tool is restarted

### Requirement: A destination is never assumed

The installer SHALL NOT write to any destination that the user did not select,
either by supplying a destination option or by choosing one when asked. An
invocation that names neither destination SHALL ask rather than pick a default.

#### Scenario: Destination is asked when not supplied

- **WHEN** the user runs the install verb without naming a destination
- **THEN** the installer asks which destinations to use before writing anything

#### Scenario: Supplied destination is not questioned

- **WHEN** the user names a destination on the command line
- **THEN** the installer does not ask which destination to use

### Requirement: Installed state is derived by comparison, not from a manifest

For each packaged skill and each destination, the installer SHALL report one of
four states, determined by comparing what is installed against what the package
ships: **not installed**, **installed and identical**, **installed but
differing from the packaged copy**, or **present but unreadable**. Determining
this state SHALL NOT depend on any record written by a previous install, so a
skill copied into place by hand is classified the same as one the installer
placed there.

#### Scenario: Hand-copied skill is recognized

- **WHEN** a skill was copied to a destination by hand and matches the packaged copy
- **THEN** it is reported as installed

#### Scenario: Locally edited skill is distinguished

- **WHEN** an installed skill's contents differ from the packaged copy
- **THEN** it is reported as differing, and not merely as installed

#### Scenario: State is reported per destination

- **WHEN** the user lists the skills
- **THEN** each skill's state is reported separately for the project and the user destination

### Requirement: Overwriting a differing copy is confirmed

When installing over an existing copy whose contents differ from the packaged
copy, the installer SHALL report the difference and obtain confirmation before
overwriting. Installing over an identical copy SHALL be reported as already
installed and SHALL NOT prompt.

#### Scenario: Differing copy prompts before overwrite

- **WHEN** the user installs a skill over a copy that differs from the packaged one
- **THEN** the installer reports that the installed copy differs and asks for confirmation
- **AND** declining leaves the installed copy unchanged

#### Scenario: Identical copy is a no-op

- **WHEN** the user installs a skill that is already installed and identical
- **THEN** nothing is written, the installer reports it as already installed, and no confirmation is requested

### Requirement: Removal is confirmed and reports what it deleted

Removal SHALL name every directory it is about to delete, by absolute path, and
obtain confirmation before deleting. A skill whose installed contents differ
from the packaged copy SHALL be identified as such in that confirmation, since
deleting it discards work that exists nowhere else. After removal, the
installer SHALL report each path it deleted.

#### Scenario: Removal names its targets before deleting

- **WHEN** the user removes a skill
- **THEN** the installer lists the absolute path of every directory to be deleted and asks for confirmation
- **AND** declining deletes nothing

#### Scenario: Removing a modified skill is called out

- **WHEN** the skill being removed differs from the packaged copy
- **THEN** the confirmation states that the installed copy has local modifications

#### Scenario: Removing what is not installed

- **WHEN** the user removes a skill that is not installed at the selected destination
- **THEN** the installer reports that it was not installed there, deletes nothing, and exits with code 0

### Requirement: Confirmation can be waived explicitly

The installer SHALL provide an option that answers every confirmation
affirmatively, so that installing and removing can be scripted. That option
SHALL NOT change what is written or deleted, only whether the user is asked.

#### Scenario: Scripted install

- **WHEN** the user supplies the confirmation-waiving option with a destination and a skill
- **THEN** the action is carried out without prompting
- **AND** the same paths are written as would have been written interactively

### Requirement: A bare invocation shows and edits the current state

Invoked with no verb and no arguments, the installer SHALL present every
packaged skill at every destination with its current state, as a selection the
user edits: selecting a skill that is not installed installs it, and clearing a
skill that is installed removes it. Before applying, the installer SHALL show
the resulting additions and deletions and obtain confirmation. Applying no
edits SHALL write and delete nothing.

#### Scenario: State is shown before it is edited

- **WHEN** the user runs the installer with no arguments
- **THEN** every packaged skill is shown for both destinations with its current state

#### Scenario: Edits are summarized before being applied

- **WHEN** the user confirms a selection that both installs and removes
- **THEN** the installer lists the paths to be written and the paths to be deleted and asks for confirmation

#### Scenario: Unchanged selection does nothing

- **WHEN** the user confirms the selection without changing it
- **THEN** nothing is written or deleted and the installer exits with code 0

### Requirement: Non-interactive invocations fail rather than hang

When the installer would need to ask a question but the session cannot accept
an answer, it SHALL report that the invocation requires a choice it cannot
prompt for, name the options that would supply the missing choice
non-interactively, and exit with code 1. It SHALL NOT wait for input that
cannot arrive, and SHALL NOT proceed by guessing the answer.

#### Scenario: Piped invocation that needs a destination

- **WHEN** the installer needs to ask for a destination and input is not an interactive terminal
- **THEN** it reports that a destination must be supplied, names the options that supply one, and exits with code 1
- **AND** it does not install to any destination

#### Scenario: Fully specified invocation still works non-interactively

- **WHEN** the skill, the destination, and the confirmation-waiving option are all supplied and input is not an interactive terminal
- **THEN** the action is carried out without prompting and exits with code 0

### Requirement: Usage errors are guided and exit codes distinguish outcomes

The installer SHALL reject an unrecognized option or an unknown skill name as a
usage error rather than ignoring it, SHALL end any usage error with a line
directing the user to its own help, and SHALL NOT print the full usage listing
in place of the error. An unknown skill name SHALL be answered with the names
the package actually ships. The installer SHALL exit with code 0 when it
completes a requested action, including one that turns out to be a no-op, and
with code 1 when the invocation could not be carried out.

#### Scenario: Unknown skill name lists the real ones

- **WHEN** the user names a skill the package does not ship
- **THEN** the error names the requested skill and lists the skills the package ships
- **AND** the process exits with code 1

#### Scenario: Unknown option is rejected

- **WHEN** the user supplies an option the installer does not recognize
- **THEN** the error names the offending option, the process exits with code 1, and nothing is written

#### Scenario: Every usage error offers a next step

- **WHEN** any usage error occurs
- **THEN** the final line of the error output directs the user to the installer's help
- **AND** the full usage listing is not printed alongside the error

#### Scenario: Help and version are informational

- **WHEN** the user requests the installer's help or version
- **THEN** the requested output is written to standard output, the process exits with code 0, and nothing is installed or removed
