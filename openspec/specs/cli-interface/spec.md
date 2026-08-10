# cli-interface Specification

## Purpose
Defines the command-line invocation surface of `opsx-read`: how options and targets are interpreted, what help and version output look like, and how the tool reports usage errors so that a mistyped command always tells the user how to recover.
## Requirements
### Requirement: Usage help is available on demand

The CLI SHALL print usage information on request and exit successfully without starting the web server. Usage output SHALL go to standard output and SHALL list every supported option, every accepted target form, and at least one example invocation.

#### Scenario: Long help flag

- **WHEN** the user runs `opsx-read --help`
- **THEN** usage information is written to standard output, the process exits with code 0, and no server is started

#### Scenario: Short help flag

- **WHEN** the user runs `opsx-read -h`
- **THEN** the same usage information is written to standard output and the process exits with code 0

#### Scenario: Help as a bare subcommand

- **WHEN** the user runs `opsx-read help`
- **THEN** the same usage information is written to standard output and the process exits with code 0
- **AND** `help` is not interpreted as a target name

### Requirement: Version is reported without side effects

The CLI SHALL report its own version on request and exit successfully. Requesting the version SHALL NOT start the web server, bind a port, or read the target directory.

#### Scenario: Version flag

- **WHEN** the user runs `opsx-read --version` or `opsx-read -v`
- **THEN** the package version is written to standard output, the process exits with code 0, and no server is started

### Requirement: Unrecognized options are rejected

The CLI SHALL treat any option it does not recognize as a usage error. An unrecognized option SHALL NOT be discarded, and the remaining arguments SHALL NOT be reinterpreted as a target. The error SHALL be written to standard error, SHALL name the offending option verbatim, and SHALL exit with code 1 without starting the server.

#### Scenario: Unknown option is reported, not swallowed

- **WHEN** the user runs `opsx-read --bananas`
- **THEN** standard error reports that `--bananas` is not a known option, the process exits with code 1, and no server is started

#### Scenario: Mistyped option does not become a target

- **WHEN** the user runs `opsx-read --prot 8080`
- **THEN** the error names `--prot` as the problem
- **AND** the error does not report `8080` as a missing path or target

#### Scenario: Near-miss option gets a suggestion

- **WHEN** an unrecognized option closely resembles a supported option, as with `--prot` and `--port`
- **THEN** the error additionally suggests the supported option

### Requirement: Every usage error points to help

Any invocation that fails because of how the command was typed SHALL end its output with a line telling the user to run `opsx-read --help`. The CLI SHALL NOT print full usage text in place of the error message, so that the error itself remains the first thing the user reads.

#### Scenario: Failed invocation offers a next step

- **WHEN** any usage error occurs, including an unknown option, an invalid port, or an unresolvable target
- **THEN** the final line of the error output directs the user to `opsx-read --help`

#### Scenario: Error is not buried under usage text

- **WHEN** a usage error occurs
- **THEN** the full usage listing is not printed alongside the error

### Requirement: Target resolution failure reports every location tried

When a target cannot be resolved, the CLI SHALL report the target as the user typed it and SHALL list every filesystem location it attempted, including both the path relative to the working directory and the path under the changes directory. Reporting only one attempted location is not sufficient.

#### Scenario: Unresolvable target lists both attempts

- **WHEN** the user runs `opsx-read teste` and neither `./teste` nor `./openspec/changes/teste` exists
- **THEN** the error names `teste` as the requested target
- **AND** the error lists both `./teste` and `./openspec/changes/teste` as locations that were tried
- **AND** the process exits with code 1

### Requirement: Target failure surfaces the available open changes

When a target cannot be resolved, the CLI SHALL help the user find the right name. If open changes exist, the error SHALL list their names, calling out any that closely resemble the requested target. If no open changes exist, the error SHALL state that plainly rather than listing nothing.

#### Scenario: Close match is suggested

- **WHEN** the target cannot be resolved and an open change name closely resembles it
- **THEN** the error presents that change name as a suggestion

#### Scenario: Available changes are listed when no close match exists

- **WHEN** the target cannot be resolved, open changes exist, and none closely resembles the target
- **THEN** the error lists the available open change names

#### Scenario: Empty change set is stated

- **WHEN** the target cannot be resolved and no open changes exist
- **THEN** the error states that there are no open changes, rather than presenting an empty list

### Requirement: Absence of open changes is explained but still served

When invoked with no target, the CLI SHALL start the server even if there are no open changes to display, so that the user can create a change and reload the page. Before starting, it SHALL report which directory was read and state that it contained no open changes. A directory holding only `archive/` SHALL count as containing no open changes.

#### Scenario: Empty changes directory still serves

- **WHEN** the user runs `opsx-read` with no target and `openspec/changes/` contains no open changes
- **THEN** the CLI reports the directory it read and states that no open changes were found
- **AND** the server starts and the process does not exit

#### Scenario: Archive-only directory counts as empty

- **WHEN** `openspec/changes/` contains only an `archive/` directory
- **THEN** the CLI reports that no open changes were found

#### Scenario: Missing changes directory is reported

- **WHEN** the user runs `opsx-read` with no target and `openspec/changes/` does not exist
- **THEN** the CLI reports that the directory was not found and directs the user to `opsx-read --help`
- **AND** the server still starts

### Requirement: Exit codes distinguish success from usage failure

The CLI SHALL exit with code 0 when it completes a requested informational action, and with code 1 when the invocation could not be carried out because of how it was typed.

#### Scenario: Informational actions succeed

- **WHEN** the user requests help or the version
- **THEN** the process exits with code 0

#### Scenario: Usage errors fail

- **WHEN** the invocation fails because of an unknown option, an invalid port value, or an unresolvable target
- **THEN** the process exits with code 1

