## MODIFIED Requirements

### Requirement: One binary, one subcommand per capability

The package SHALL install exactly one executable, named `opsx-tools`. Every
capability the package provides SHALL be reached as a subcommand of that
executable: reading as `read`, skill management as `skill`, project
provisioning as `init`. The package SHALL NOT install any second executable,
and SHALL NOT install a forwarding wrapper under a name it used previously. The
root usage output SHALL list every subcommand, so the full set of capabilities
is discoverable from the binary name alone.

#### Scenario: A single executable is installed

- **WHEN** the package is installed
- **THEN** exactly one executable, `opsx-tools`, is placed on the user's `PATH`
- **AND** no executable named `opsx-read` or `opsx-skills` is installed

#### Scenario: Reading is reached through the read subcommand

- **WHEN** the user runs `opsx-tools read` with no target
- **THEN** the reader starts, exactly as it would have for the previous reading binary

#### Scenario: Skill management is reached through the skill subcommand

- **WHEN** the user runs `opsx-tools skill` with no verb
- **THEN** the interactive install-and-remove selection is presented, exactly as it would have been for the previous skills binary

#### Scenario: Provisioning is reached through the init subcommand

- **WHEN** the user runs `opsx-tools init`
- **THEN** the project is provisioned according to the provisioning capability

#### Scenario: Subcommands are discoverable from the root

- **WHEN** the user runs `opsx-tools --help`
- **THEN** the usage output lists `read`, `skill`, and `init` as available subcommands
