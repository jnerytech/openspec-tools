# artifact-language Specification

## Purpose
Defines the provisionable component that fixes the language OpenSpec artifacts
are written in: where the directive is stored so that OpenSpec delivers it when
an artifact is written, how it is delimited so it can be found and taken back
again, and how it is reported, changed, and removed without disturbing anything
else in a file the user owns.
## Requirements
### Requirement: The directive is stored where OpenSpec delivers it to artifact writing

The language directive SHALL be written into the project configuration file that
OpenSpec injects into every artifact instruction, at `openspec/config.yaml` or
`openspec/config.yml`, whichever the project has. It SHALL be placed in the
field that carries project context into those instructions, so that the
directive reaches the agent at the moment an artifact is written and at no other
time. The component SHALL NOT write the directive into any always-on instruction
file, and SHALL NOT introduce a configuration key of its own, which the
configuration schema would discard.

#### Scenario: The directive is written to the project configuration

- **WHEN** the user provisions the artifact language
- **THEN** the directive is written into the project's OpenSpec configuration file, in the field injected into artifact instructions

#### Scenario: Either configuration filename is recognized

- **WHEN** the project's configuration file is named `config.yml` rather than `config.yaml`
- **THEN** that file is the one read and written
- **AND** a second configuration file is not created alongside it

#### Scenario: A missing configuration file is reported, not invented

- **WHEN** the project has an `openspec/` directory but no configuration file
- **THEN** the component reports that the configuration file is absent and provisions nothing
- **AND** it does not create one, because the file requires a schema value the package cannot choose on the user's behalf

### Requirement: The directive names the chosen language and is scoped to artifacts

The directive SHALL state the language the user chose and SHALL state that it
governs OpenSpec artifacts. It SHALL NOT claim authority over the agent's replies,
over code or comments, or over commit messages. The set of offered languages
SHALL include at least one explicit choice and SHALL accept a language the user
names themselves, so a language the package did not anticipate is still
reachable.

#### Scenario: The directive names the language

- **WHEN** the user chooses a language and provisions the component
- **THEN** the written directive names that language

#### Scenario: The directive is scoped to artifacts

- **WHEN** the directive is written
- **THEN** its text identifies OpenSpec artifacts as what it governs
- **AND** it does not direct the language of conversation, code, or commit messages

#### Scenario: A language outside the offered set is accepted

- **WHEN** the user supplies a language that is not among the offered choices
- **THEN** that language is accepted and named in the directive

### Requirement: The directive is delimited and reports which language is set

The directive SHALL be enclosed in a delimited region that identifies the
package as its author and records the chosen language. The component SHALL
determine its state by reading that region: absent when no region is present,
and otherwise present with the language the region records. Reporting state
SHALL NOT require a record kept anywhere other than the file itself.

#### Scenario: State names the configured language

- **WHEN** the region is present and records a language
- **THEN** the component reports the component as provisioned and names that language

#### Scenario: Absence is reported as absent

- **WHEN** no region written by the package is present in the configuration file
- **THEN** the component reports the artifact language as not set

#### Scenario: No separate record is consulted

- **WHEN** the component reports its state
- **THEN** the state is derived from the configuration file alone, with no manifest or state file elsewhere

### Requirement: The configuration file is edited surgically, never rewritten

Writing, changing, or removing the directive SHALL alter only the delimited
region and, where required, the single key that holds it. Every other byte of
the configuration file SHALL be preserved, including comments, commented-out
examples, blank lines, key order, and indentation style. The component SHALL NOT
parse the file into a data structure and serialize it back, because doing so
discards the explanatory comments the file ships with.

#### Scenario: Comments survive the edit

- **WHEN** the directive is written into a configuration file containing comments and commented-out examples
- **THEN** every comment is present and unchanged afterwards

#### Scenario: Other configuration is untouched

- **WHEN** the configuration file declares other keys
- **THEN** those keys, their values, and their order are unchanged afterwards

#### Scenario: The user's own context is preserved

- **WHEN** the field that carries project context already holds text the user wrote
- **THEN** that text is present and unchanged afterwards
- **AND** the directive is added alongside it rather than in place of it

### Requirement: Removing takes back exactly what was written

Deselecting the component SHALL remove the delimited region and nothing else.
When removing the region leaves the field that held it with no remaining
content, the field SHALL be removed as well, so no empty key is left behind.
Text the user wrote in that field SHALL survive removal.

#### Scenario: Removal leaves the user's own text

- **WHEN** the component is removed and the field also holds text the user wrote
- **THEN** the region is gone and the user's text remains, with the field intact

#### Scenario: Removal takes the empty field with it

- **WHEN** the component is removed and the region was the field's only content
- **THEN** the field is removed as well, rather than left present and empty

#### Scenario: The rest of the file survives removal

- **WHEN** the component is removed
- **THEN** every other key, comment, and blank line in the configuration file is unchanged

### Requirement: A hand-edited region is reported, never overwritten or duplicated

When the delimited region is present but its content is not what the package
would write for the language the region records, the component SHALL report that
it differs, SHALL show the difference, and SHALL require a confirmation before
replacing or removing it. When the delimiters are present but damaged — only one
of them found, or the closing one before the opening one — the component SHALL
report the file as unsafe to edit, SHALL change nothing, and SHALL exit with
code 1. The component SHALL NOT match its region by resemblance, and SHALL NOT
add a second directive because it failed to recognize the first.

#### Scenario: An edited region is reported and confirmed

- **WHEN** the region is present and its content has been edited by hand
- **THEN** the component reports that it differs from what the package writes, shows the difference, and asks before changing it

#### Scenario: Declining leaves the edited region alone

- **WHEN** the user declines that confirmation
- **THEN** the region is left exactly as the user edited it

#### Scenario: Damaged delimiters stop the edit

- **WHEN** only one delimiter is present, or the closing delimiter appears before the opening one
- **THEN** the component reports that the file cannot be edited safely, changes nothing, and exits with code 1

#### Scenario: A directive is never added twice

- **WHEN** the component provisions into a file that already holds a region written by the package
- **THEN** the existing region is replaced and exactly one region remains

### Requirement: Changing the language replaces the directive

Choosing a different language for a project that already has one SHALL rewrite
the existing region in place. Directives SHALL NOT accumulate: after any
provisioning, at most one language directive written by the package SHALL be
present in the configuration file.

#### Scenario: A new language replaces the old one

- **WHEN** the project has a directive for one language and the user provisions a different one
- **THEN** the directive names the new language and the old one is gone

#### Scenario: Exactly one directive remains

- **WHEN** provisioning completes for any language
- **THEN** the configuration file contains exactly one region written by the package
