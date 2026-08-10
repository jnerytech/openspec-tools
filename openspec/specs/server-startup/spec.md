# server-startup Specification

## Purpose
Defines how the reader chooses the address it listens on, how it recovers when that address is unavailable, and how it identifies the project it is serving — so that several readers can run at once across different projects without the user assigning ports by hand.
## Requirements
### Requirement: The listening port is derived from the project

When no port is requested, the reader SHALL derive its port from the identity of the project being served. The derivation SHALL be deterministic: the same project SHALL yield the same port on every run, on the same machine and across machines, without reading or writing any stored state. The derived port SHALL fall within a fixed unprivileged range of 4242 to 4999 inclusive.

#### Scenario: Same project yields the same port

- **WHEN** the reader is started twice for the same project, with the second run beginning after the first has stopped
- **THEN** both runs listen on the same port

#### Scenario: Different projects yield different ports

- **WHEN** readers are started for two projects whose roots differ
- **THEN** each derives its own port, and neither has to be told a port

#### Scenario: Derived port stays in range

- **WHEN** the reader derives a port
- **THEN** the port is between 4242 and 4999 inclusive

#### Scenario: No state is persisted

- **WHEN** the reader derives a port
- **THEN** no file, cache, or registry is created or updated to record the choice
- **AND** deleting nothing and creating nothing is required for the next run to reach the same port

### Requirement: Project identity does not depend on the working directory

The reader SHALL resolve the project it is serving to a single root directory before deriving a port or naming the project. The root SHALL be the nearest enclosing directory that owns an `openspec/` directory; failing that, the nearest enclosing repository root; failing that, the working directory. The resolved root SHALL be an absolute path with symbolic links resolved.

#### Scenario: Subdirectory invocation reaches the same port

- **WHEN** the reader is started from a project's root, and again from a subdirectory of that same project
- **THEN** both runs resolve to the same project root and listen on the same port

#### Scenario: Symlinked path is the same project

- **WHEN** a project is reached through a symbolic link rather than its real path
- **THEN** it resolves to the same project root as the real path

#### Scenario: No project markers still resolves

- **WHEN** the reader is started in a directory with no enclosing `openspec/` directory and no enclosing repository
- **THEN** the working directory is used as the project root and a port is still derived

### Requirement: A derived port that is unavailable falls back and says so

When the derived port cannot be bound because it is already in use, the reader SHALL try further ports within the range and start on the first one it can bind. It SHALL report that the derived port was unavailable and name the port it settled on. It SHALL NOT fail, and SHALL NOT fall silent about the substitution.

#### Scenario: Busy derived port is substituted

- **WHEN** the reader derives a port that another process already holds
- **THEN** the reader starts on a different port within the range
- **AND** the output states that the derived port was in use and names the port actually bound

#### Scenario: Second reader for the same project starts anyway

- **WHEN** a second reader is started for a project that already has one running
- **THEN** the second one starts on a different port rather than failing

#### Scenario: Range exhausted fails with guidance

- **WHEN** no port in the range can be bound
- **THEN** the reader reports that it could not find a free port, states the range it tried, and directs the user to supply a port explicitly
- **AND** the process exits with code 1

### Requirement: An explicitly requested port is never substituted

When the user requests a specific port, the reader SHALL bind that port or fail. It SHALL NOT try a different port. A request that cannot be bound SHALL produce an error that names the requested port and points at the automatic behaviour as the alternative.

#### Scenario: Busy requested port is an error

- **WHEN** the user requests a port that another process already holds
- **THEN** the reader reports that the requested port is in use, names it, and states that omitting the option lets the reader choose a port
- **AND** the process exits with code 1 without starting the server

#### Scenario: Requested port is honoured exactly

- **WHEN** the user requests a free port
- **THEN** the reader listens on exactly that port, whatever the derived port would have been

### Requirement: Startup failures are reported, never thrown

The reader SHALL report every failure to start the server as a readable message on standard error. No failure to bind SHALL surface as an uncaught exception or a stack trace. A failure caused by the port being in use SHALL be reported differently from a failure caused by anything else, and the other cause SHALL be named.

#### Scenario: Port in use is not a stack trace

- **WHEN** a port cannot be bound because it is in use
- **THEN** the output is a readable message about that port
- **AND** no stack trace is printed

#### Scenario: Other bind failures are named

- **WHEN** the server fails to start for a reason other than the port being in use, such as insufficient permission for a privileged port
- **THEN** the reader reports that reason rather than reporting the port as in use
- **AND** the process exits with code 1

### Requirement: The reader announces the project it is serving

On successful startup the reader SHALL print the URL it bound and SHALL identify the project being served by name, together with what is being read. The project name SHALL be derived from the resolved project root. Printing the URL alone is not sufficient, because several readers may be running at once.

#### Scenario: Startup names the project

- **WHEN** the reader starts successfully
- **THEN** the output includes the bound URL and the name of the project being served

#### Scenario: Startup names the target

- **WHEN** the reader starts for a specific change, folder, or file
- **THEN** the output identifies what is being read in addition to the project

#### Scenario: Two readers are distinguishable

- **WHEN** readers are running for two different projects
- **THEN** each one's startup output names its own project, so the two can be told apart without comparing port numbers

### Requirement: Served pages identify the project

Every page the reader serves SHALL identify the project it belongs to, both in the browser tab title and on the page itself. The identification SHALL be present regardless of which target is being read.

#### Scenario: Tab title carries the project

- **WHEN** any page is served
- **THEN** its title includes the project name, so a row of browser tabs from different projects is legible

#### Scenario: Page body carries the project

- **WHEN** any page is served
- **THEN** the rendered page shows the project name, so a screenshot or a read-aloud session carries its own context

### Requirement: The reader stays on the loopback interface

The reader SHALL bind only the loopback interface, whether the port was derived or requested. Automatic port selection SHALL NOT widen what the server is reachable from.

#### Scenario: Derived port binds loopback only

- **WHEN** the reader starts on a derived port
- **THEN** the server is reachable at `localhost` and is not bound to any external interface

#### Scenario: Requested port binds loopback only

- **WHEN** the reader starts on a requested port
- **THEN** the server is reachable at `localhost` and is not bound to any external interface
