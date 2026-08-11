## Why

The reader binds the loopback interface and prints `http://localhost:<port>`. Over a plain terminal SSH session that URL points at the wrong machine: the user's browser resolves `localhost` to their own laptop, where nothing is listening. The reader knows it is running in a remote session and knows the port it bound, so it can say what the user needs to do instead of leaving them to guess that the reader is broken.

The fix is guidance, not a wider binding. Loopback-only stays.

## What Changes

- On successful startup, when the reader detects it is running inside a remote shell session, it prints the port-forwarding command that makes the printed URL reachable, using the port actually bound.
- The hint is absent when the reader is running locally, so the common case keeps its current two-line banner.
- No change to what the server binds. The reader remains reachable only on the loopback interface, whether the port was derived or requested.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `server-startup`: the startup announcement gains a conditional requirement — a remote session also gets the forwarding command needed to reach the printed URL. The existing loopback requirement is reaffirmed unchanged, since the hint exists precisely so that widening the binding is unnecessary.

## Impact

- `src/server.ts` — `startServer` startup output only. The bind path (`bind`, `bindDerived`, `bindRequested`, `LOOPBACK`) is untouched.
- No new CLI flags, no new dependencies, no configuration.
- README's description of startup output may need a line.
