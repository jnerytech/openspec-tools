## MODIFIED Requirements

### Requirement: Archived changes are displayed only when requested

The reader SHALL NOT display archived changes unless the user asks for them, either by supplying the option that includes them or by naming one as a target. The absence of open changes SHALL NOT cause archived changes to be displayed. Archived changes SHALL NOT be counted among the open changes.

#### Scenario: Default invocation hides the archive

- **WHEN** the user runs `opsx-tools read` with no target and without the option that includes archived changes
- **THEN** no archived change appears in the reader

#### Scenario: An empty open set does not reveal the archive

- **WHEN** `openspec/changes/` contains only an `archive/` directory and the user has not asked for archived changes
- **THEN** the reader displays no changes rather than falling back to the archived ones

#### Scenario: Requested archived changes are displayed

- **WHEN** the user asks for archived changes to be included
- **THEN** every archived change is available to read
