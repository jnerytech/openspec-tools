# cli-interface Specification

## Purpose
Defines the command-line invocation surface of `opsx-tools`: how the binary's capabilities are reached as subcommands, how options and targets are interpreted, what help and version output look like, and how the tool reports usage errors so that a mistyped command always tells the user how to recover.
## Requirements
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

### Requirement: The bare invocation is informational

Invoked with no subcommand, `opsx-tools` SHALL print usage to standard output
and exit with code 0. It SHALL NOT choose a capability on the user's behalf: it
SHALL NOT start the reader, bind a port, or read the changes directory, and it
SHALL NOT install, remove, or prompt about skills.

#### Scenario: Bare invocation prints usage

- **WHEN** the user runs `opsx-tools` with no arguments
- **THEN** usage information is written to standard output and the process exits with code 0

#### Scenario: Bare invocation has no side effects

- **WHEN** the user runs `opsx-tools` with no arguments
- **THEN** no port is bound, no server is started, and nothing is written to or deleted from any skills directory

#### Scenario: Bare invocation does not wait for input

- **WHEN** the user runs `opsx-tools` with no arguments and input is not an interactive terminal
- **THEN** usage is written to standard output and the process exits with code 0 without waiting for input

### Requirement: Usage help is available on demand

The CLI SHALL print usage information on request and exit successfully without
starting the web server. Usage output SHALL go to standard output. Help SHALL
be available at the root, where it lists every subcommand, and separately for
each subcommand, where it lists every option that subcommand supports, every
accepted target or argument form, and at least one example invocation. Root
help SHALL NOT be substituted for subcommand help: asking for help on a
subcommand SHALL describe that subcommand.

#### Scenario: Long help flag

- **WHEN** the user runs `opsx-tools --help` or `opsx-tools read --help`
- **THEN** usage information is written to standard output, the process exits with code 0, and no server is started

#### Scenario: Short help flag

- **WHEN** the user runs `opsx-tools -h` or `opsx-tools read -h`
- **THEN** the same usage information as the corresponding long flag is written to standard output and the process exits with code 0

#### Scenario: Help as a bare subcommand

- **WHEN** the user runs `opsx-tools help`
- **THEN** the root usage information is written to standard output and the process exits with code 0
- **AND** at the root there is no target for `help` to be confused with

#### Scenario: Subcommand help describes the subcommand

- **WHEN** the user runs `opsx-tools read --help`
- **THEN** the usage output lists the options the `read` subcommand supports and the target forms it accepts
- **AND** the output is not the root usage listing

#### Scenario: Every subcommand has its own help

- **WHEN** the user asks for help on `skill` or on any verb beneath it
- **THEN** usage information for that subcommand is written to standard output and the process exits with code 0

### Requirement: Version is reported without side effects

The CLI SHALL report its own version on request and exit successfully.
Requesting the version SHALL NOT start the web server, bind a port, read the
target directory, or write to any skills directory. One version SHALL be
reported for the package as a whole; the subcommands SHALL NOT carry
independent versions.

#### Scenario: Version flag

- **WHEN** the user runs `opsx-tools --version` or `opsx-tools -v`
- **THEN** the package version is written to standard output, the process exits with code 0, and no server is started

#### Scenario: One version for the whole package

- **WHEN** the version is requested
- **THEN** the reported version is the package version, regardless of which capability the user came to use

### Requirement: Including archived changes is an explicit option

The CLI SHALL provide an option that includes archived changes in the reader.
The option SHALL be listed in the usage output for the `read` subcommand
alongside every other option that subcommand supports. Archived changes SHALL
be excluded unless that option is supplied or an archived change is named as a
target; there SHALL be no invocation in which archived changes appear without
the user having asked for them.

#### Scenario: Option is documented

- **WHEN** the user runs `opsx-tools read --help`
- **THEN** the usage output lists the option that includes archived changes

#### Scenario: Option is recognized, not treated as a target

- **WHEN** the user supplies the option that includes archived changes
- **THEN** the CLI starts the reader with archived changes included
- **AND** the option is not reported as an unresolvable target

#### Scenario: Archived changes are excluded by default

- **WHEN** the user runs `opsx-tools read` without that option and without naming an archived change
- **THEN** the reader is started with archived changes excluded

### Requirement: The port option overrides an automatic choice

The CLI SHALL treat the port option as an override rather than as a replacement
for a fixed default. Omitting it SHALL be a supported invocation in which the
reader chooses a port for itself, and SHALL NOT bind one hardcoded port shared
by every project on the machine. The usage output for the `read` subcommand
SHALL state that the port is chosen automatically when the option is omitted,
so the user does not have to discover the behaviour by running the command
twice.

#### Scenario: Automatic choice is documented

- **WHEN** the user runs `opsx-tools read --help`
- **THEN** the usage output describes the port option as an override and states that a port is chosen automatically when it is omitted
- **AND** the usage output does not present a single fixed port as the default

#### Scenario: Omitting the option is a complete invocation

- **WHEN** the user runs `opsx-tools read` with no port option
- **THEN** the reader starts without asking for a port and without requiring one on any subsequent run

#### Scenario: Invalid port value is still a usage error

- **WHEN** the user runs `opsx-tools read --port abc`
- **THEN** the CLI reports that the port must be a number, exits with code 1, and does not fall back to choosing a port automatically

### Requirement: Unrecognized options are rejected

The CLI SHALL treat any option it does not recognize as a usage error. An
unrecognized option SHALL NOT be discarded, and the remaining arguments SHALL
NOT be reinterpreted as a target. The error SHALL be written to standard error,
SHALL name the offending option verbatim, and SHALL exit with code 1 without
starting the server. An unrecognized subcommand SHALL be rejected on the same
terms.

#### Scenario: Unknown option is reported, not swallowed

- **WHEN** the user runs `opsx-tools read --bananas`
- **THEN** standard error reports that `--bananas` is not a known option, the process exits with code 1, and no server is started

#### Scenario: Mistyped option does not become a target

- **WHEN** the user runs `opsx-tools read --prot 8080`
- **THEN** the error names `--prot` as the problem
- **AND** the error does not report `8080` as a missing path or target

#### Scenario: Near-miss option gets a suggestion

- **WHEN** an unrecognized option closely resembles a supported option, as with `--prot` and `--port`
- **THEN** the error additionally suggests the supported option

#### Scenario: Unknown subcommand is rejected

- **WHEN** the user runs `opsx-tools raed`
- **THEN** standard error reports that `raed` is not a known command, the process exits with code 1, and no capability is invoked

### Requirement: Every usage error points to help

Any invocation that fails because of how the command was typed SHALL end its
output with a line telling the user how to get help. That line SHALL name the
help of the subcommand the user was invoking, so the suggested command answers
the question the user actually asked; a failure before any subcommand is
selected SHALL point at the root help. The CLI SHALL NOT print full usage text
in place of the error message, so that the error itself remains the first thing
the user reads.

#### Scenario: Failed invocation offers a next step

- **WHEN** any usage error occurs, including an unknown option, an invalid port, or an unresolvable target
- **THEN** the final line of the error output directs the user to a help command

#### Scenario: The suggested help matches the failing subcommand

- **WHEN** an invocation of `opsx-tools read` fails because of how it was typed
- **THEN** the final line of the error output directs the user to `opsx-tools read --help`
- **AND** it does not direct the user to the root help

#### Scenario: A failure before a subcommand points at the root

- **WHEN** an invocation fails before any subcommand has been selected, as with an unknown command name
- **THEN** the final line of the error output directs the user to `opsx-tools --help`

#### Scenario: Error is not buried under usage text

- **WHEN** a usage error occurs
- **THEN** the full usage listing is not printed alongside the error

### Requirement: A positional word after a verb is always a target

Under the `read` subcommand, every positional word SHALL be interpreted as a
target. No word SHALL be reserved as a command in that position. A change whose
name collides with a subcommand name, a verb name, or `help` SHALL be reachable
by its bare name, without requiring the user to address it by path.

#### Scenario: A change named help is reachable by name

- **WHEN** the user runs `opsx-tools read help` and an open change named `help` exists
- **THEN** the CLI serves that change
- **AND** usage information is not printed in its place

#### Scenario: A change whose name collides with a subcommand is reachable by name

- **WHEN** the user runs `opsx-tools read skill` and an open change named `skill` exists
- **THEN** the CLI serves that change

#### Scenario: An unresolvable positional word is a target error

- **WHEN** the user runs `opsx-tools read list` and no change or path named `list` exists
- **THEN** the CLI reports `list` as an unresolvable target
- **AND** the CLI does not report `list` as an unknown command

### Requirement: An archived change can be given as a target

The CLI SHALL resolve an archived change named as a target, whether the user
types the archived directory name including its date prefix or the display name
without it. Naming an archived change SHALL be sufficient to read it; the option
that includes archived changes SHALL NOT additionally be required. If the name
matches both an open change and an archived change, the open change SHALL win,
and the CLI SHALL report that an archived change of the same name also exists,
naming the command that reads it.

#### Scenario: Archived change resolved by directory name

- **WHEN** the user runs `opsx-tools read 2026-08-10-improve-cli-error-guidance` and that directory exists under the archive
- **THEN** the CLI serves that archived change

#### Scenario: Archived change resolved by display name

- **WHEN** the user runs `opsx-tools read improve-cli-error-guidance`, no open change has that name, and an archived change has that display name
- **THEN** the CLI serves that archived change

#### Scenario: Open change wins a name conflict

- **WHEN** the target names both an open change and an archived change
- **THEN** the CLI serves the open change
- **AND** the CLI reports that an archived change of the same name exists
- **AND** the reported command that reads it is a complete, runnable invocation

### Requirement: Target resolution failure reports every location tried

When a target cannot be resolved, the CLI SHALL report the target as the user
typed it and SHALL list every filesystem location it attempted, including the
path relative to the working directory, the path under the changes directory,
and the path under the archive directory. Reporting only one attempted location
is not sufficient.

#### Scenario: Unresolvable target lists both attempts

- **WHEN** the user runs `opsx-tools read teste` and none of `./teste`, `./openspec/changes/teste`, or `./openspec/changes/archive/teste` exists
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

When the reader is invoked with no target, the CLI SHALL start the server even
if there are no open changes to display, so that the user can create a change
and reload the page. Before starting, it SHALL report which directory was read
and state that it contained no open changes. A directory holding only
`archive/` SHALL count as containing no open changes, and in that case the
report SHALL name the option that displays the archived changes. Reporting that
option SHALL NOT cause archived changes to be displayed. Any command the report
names SHALL be a complete, runnable invocation.

#### Scenario: Empty changes directory still serves

- **WHEN** the user runs `opsx-tools read` with no target and `openspec/changes/` contains no open changes
- **THEN** the CLI reports the directory it read and states that no open changes were found
- **AND** the server starts and the process does not exit

#### Scenario: Archive-only directory counts as empty

- **WHEN** `openspec/changes/` contains only an `archive/` directory
- **THEN** the CLI reports that no open changes were found
- **AND** the report names the option that displays the archived changes
- **AND** the archived changes are not displayed

#### Scenario: Missing changes directory is reported

- **WHEN** the user runs `opsx-tools read` with no target and `openspec/changes/` does not exist
- **THEN** the CLI reports that the directory was not found and directs the user to `opsx-tools read --help`
- **AND** the server still starts

### Requirement: Exit codes distinguish success from usage failure

The CLI SHALL exit with code 0 when it completes a requested informational action, and with code 1 when the invocation could not be carried out because of how it was typed.

#### Scenario: Informational actions succeed

- **WHEN** the user requests help or the version
- **THEN** the process exits with code 0

#### Scenario: Usage errors fail

- **WHEN** the invocation fails because of an unknown option, an invalid port value, or an unresolvable target
- **THEN** the process exits with code 1
