## 1. Session detection

- [x] 1.1 Add a helper in `src/server.ts` that reads `SSH_CONNECTION` and returns the server address (its third field), treating a missing or unparseable value as absent
- [x] 1.2 Fall back to `SSH_TTY`/`SSH_CLIENT` for detecting a remote session when `SSH_CONNECTION` gives no address, so detection and address resolution can disagree
- [x] 1.3 Resolve the login name from `USER`/`LOGNAME`, falling back to a `<user>` placeholder

## 2. Hint output

- [x] 2.1 Add a helper that formats `ssh -L <port>:localhost:<port> <user>@<host>` from the bound port plus the values from group 1, substituting `<host>` when no address was resolved
- [x] 2.2 Append the hint to the startup banner in `startServer`, after the URL and project lines, only when a remote session was detected
- [x] 2.3 Confirm the hint uses `bound`, not `derived`, so a substituted port is reflected

## 3. Verification

- [x] 3.1 Run the reader with `SSH_CONNECTION` unset and confirm the banner is byte-identical to today's
- [x] 3.2 Run it with `SSH_CONNECTION` set to a synthetic value and confirm the command carries the parsed address and the bound port
- [x] 3.3 Occupy the derived port, start again in a simulated remote session, and confirm the hint names the substituted port
- [x] 3.4 Run with `SSH_TTY` set but `SSH_CONNECTION` unset and confirm the hint appears with the `<host>` placeholder

## 4. Documentation

- [x] 4.1 Update the README's description of startup output to mention the remote hint and state that the binding is unchanged
