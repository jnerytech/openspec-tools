## ADDED Requirements

### Requirement: The port option overrides an automatic choice

The CLI SHALL treat the port option as an override rather than as a replacement for a fixed default. Omitting it SHALL be a supported invocation in which the reader chooses a port for itself, and SHALL NOT bind one hardcoded port shared by every project on the machine. The usage output SHALL state that the port is chosen automatically when the option is omitted, so the user does not have to discover the behaviour by running the command twice.

#### Scenario: Automatic choice is documented

- **WHEN** the user runs `opsx-read --help`
- **THEN** the usage output describes the port option as an override and states that a port is chosen automatically when it is omitted
- **AND** the usage output does not present a single fixed port as the default

#### Scenario: Omitting the option is a complete invocation

- **WHEN** the user runs `opsx-read` with no port option
- **THEN** the reader starts without asking for a port and without requiring one on any subsequent run

#### Scenario: Invalid port value is still a usage error

- **WHEN** the user runs `opsx-read --port abc`
- **THEN** the CLI reports that the port must be a number, exits with code 1, and does not fall back to choosing a port automatically
