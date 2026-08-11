## ADDED Requirements

### Requirement: A remote session is told how to reach the printed URL

When the reader starts inside a remote shell session, the printed `localhost` URL names a machine other than the one running the user's browser. In that case the reader SHALL, in addition to its normal startup output, print a port-forwarding command that makes the printed URL reachable from the machine the user is sitting at. The command SHALL carry the port actually bound, so it stays correct when a derived port was substituted or a port was requested explicitly. The reader SHALL NOT change what it binds in order to produce this guidance.

#### Scenario: Remote session gets the forwarding command

- **WHEN** the reader starts successfully inside a remote shell session
- **THEN** the output includes the bound URL, the project name, and a port-forwarding command
- **AND** the port in that command is the port the reader actually bound

#### Scenario: Substituted port appears in the command

- **WHEN** the reader starts in a remote session on a port other than the one it derived, because the derived port was in use
- **THEN** the forwarding command names the port that was bound, not the port that was derived

#### Scenario: Local session is unchanged

- **WHEN** the reader starts successfully outside a remote shell session
- **THEN** no forwarding command is printed
- **AND** the output is the bound URL and the project identification as before

#### Scenario: Guidance does not widen the binding

- **WHEN** the reader prints a forwarding command
- **THEN** the server is still reachable only on the loopback interface
