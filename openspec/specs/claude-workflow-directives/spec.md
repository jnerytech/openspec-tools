# claude-workflow-directives Specification

## Purpose
Defines the provisionable component that records Claude Code working agreements
for work under `openspec/`: which agreements are offered, where they are written
so that Claude Code receives them without another client being told about tools
it does not have, and what the package does and does not claim about the agent
acting on them.
## Requirements
### Requirement: The agreements are written where Claude Code reads them

The directives SHALL be written into `CLAUDE.md` at the resolved project root.
They SHALL NOT be written into `openspec/config.yaml`, `openspec/config.yml`, or
`AGENTS.md`. When `CLAUDE.md` does not exist, the component SHALL create it;
unlike the OpenSpec configuration file, it has no required field the package
would have to invent.

#### Scenario: The directives are written to CLAUDE.md

- **WHEN** the user provisions the working agreements
- **THEN** the directives are written into `CLAUDE.md` at the resolved project root

#### Scenario: A missing CLAUDE.md is created

- **WHEN** the project has no `CLAUDE.md` and the user provisions the working agreements
- **THEN** `CLAUDE.md` is created containing the directives

#### Scenario: Tool-agnostic files are not written

- **WHEN** the working agreements are provisioned
- **THEN** the OpenSpec configuration file is unchanged
- **AND** `AGENTS.md` is unchanged, whether or not it exists

### Requirement: Two agreements are offered, each independently switchable

The component SHALL offer exactly two agreements: keeping a task list while
working, and asking the user rather than assuming when a decision is
ambiguous. Each SHALL be switchable on its own, so provisioning one does not
require the other. Selecting neither SHALL be equivalent to not provisioning the
component at all.

#### Scenario: One agreement without the other

- **WHEN** the user provisions the task-list agreement and not the asking agreement
- **THEN** the written directives include the task-list agreement only

#### Scenario: Both agreements together

- **WHEN** the user provisions both agreements
- **THEN** the written directives include both

#### Scenario: Neither agreement removes the component

- **WHEN** the user provisions the component with neither agreement selected
- **THEN** no directives remain in `CLAUDE.md` and the component reports as not provisioned

### Requirement: The agreements are scoped to OpenSpec work

Each directive SHALL state that it applies to work on files under `openspec/`.
The component SHALL NOT write a directive that claims authority over the agent's
behaviour on unrelated work in the same repository.

#### Scenario: The directive names its scope

- **WHEN** a directive is written
- **THEN** its text identifies work on files under `openspec/` as what it governs

#### Scenario: Unrelated work is not claimed

- **WHEN** a directive is written
- **THEN** it does not direct the agent's behaviour on work outside `openspec/`

### Requirement: The directives are delimited and report which agreements are set

The directives SHALL be enclosed in a delimited region that identifies the
package as its author and records which agreements are enabled. The component
SHALL determine its state by reading that region, and SHALL report which
agreements are set rather than only that the component is provisioned. Because
`CLAUDE.md` is Markdown, the delimiters SHALL be comments in that format, so
they do not appear in the rendered text.

#### Scenario: State names the enabled agreements

- **WHEN** the region is present
- **THEN** the component reports which agreements are enabled

#### Scenario: Absence is reported as absent

- **WHEN** no region written by the package is present in `CLAUDE.md`
- **THEN** the component reports the working agreements as not set

#### Scenario: Delimiters do not render

- **WHEN** the region is written into `CLAUDE.md`
- **THEN** its delimiters are Markdown comments and do not appear as visible text

### Requirement: CLAUDE.md is edited surgically

Writing, changing, or removing the directives SHALL alter only the delimited
region. Every other byte of `CLAUDE.md` SHALL be preserved, including the user's
own headings, prose, lists, and blank lines. When the region is removed and the
package had created the file, and nothing else remains in it, the file SHALL be
removed as well, so provisioning leaves no empty file behind.

#### Scenario: The user's own content survives

- **WHEN** the directives are written into a `CLAUDE.md` that already holds the user's content
- **THEN** that content is present and unchanged afterwards

#### Scenario: Removal leaves the rest of the file

- **WHEN** the component is removed and `CLAUDE.md` holds other content
- **THEN** the region is gone and every other line is unchanged

#### Scenario: An emptied file the package created is removed

- **WHEN** the component is removed, the package had created `CLAUDE.md`, and the region was its only content
- **THEN** the file is removed rather than left empty

#### Scenario: An emptied file the user created is kept

- **WHEN** the component is removed and `CLAUDE.md` existed before the package wrote to it
- **THEN** the file is kept, even if it is now empty

### Requirement: A hand-edited region is reported, never overwritten or duplicated

When the region is present but its content is not what the package would write
for the agreements the region records, the component SHALL report that it
differs, SHALL show the difference, and SHALL require a confirmation before
replacing or removing it. When the delimiters are damaged — only one found, or
the closing one before the opening one — the component SHALL report the file as
unsafe to edit, SHALL change nothing, and SHALL exit with code 1. The component
SHALL NOT match its region by resemblance, and SHALL NOT add a second region
because it failed to recognize the first.

#### Scenario: An edited region is reported and confirmed

- **WHEN** the region is present and its content has been edited by hand
- **THEN** the component reports that it differs from what the package writes, shows the difference, and asks before changing it

#### Scenario: Declining leaves the edited region alone

- **WHEN** the user declines that confirmation
- **THEN** the region is left exactly as the user edited it

#### Scenario: Damaged delimiters stop the edit

- **WHEN** only one delimiter is present, or the closing delimiter appears before the opening one
- **THEN** the component reports that the file cannot be edited safely, changes nothing, and exits with code 1

#### Scenario: A region is never added twice

- **WHEN** the component provisions into a file that already holds a region written by the package
- **THEN** the existing region is replaced and exactly one region remains

### Requirement: The package claims delivery, not obedience

Any report, help text, or documentation describing this component SHALL
represent the directives as instructions delivered to the agent, and SHALL NOT
state or imply that the agent is thereby required or guaranteed to follow them.
The component's success condition is that the directive is present, correct, and
removable.

#### Scenario: Reporting describes what was written

- **WHEN** provisioning the working agreements succeeds
- **THEN** the report states that the directives were written
- **AND** it does not state that the agent will now always follow them

#### Scenario: Help text does not promise enforcement

- **WHEN** the user reads the help or documentation for this component
- **THEN** the agreements are described as instructions given to the agent rather than as enforced behaviour
