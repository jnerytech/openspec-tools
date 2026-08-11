## Context

See proposal.md — Why. The relevant existing state: `startServer` in `src/server.ts` binds `LOOPBACK` and then prints a two-line banner built from `bound`, `project.name`, and `describeTarget(...)`. `openspec/specs/server-startup/spec.md` requires loopback-only binding, and the archived `assign-port-per-project` design lists serving on any other interface as out of scope.

The one genuine unknown is that a forwarding command needs an address to connect back to, and the reader does not otherwise know how the user reached this machine.

## Goals / Non-Goals

**Goals:**
- Decide how a remote session is detected, and what the command says when the pieces needed to build it are not all available.

**Non-Goals:**
- Any change to binding, ports, or CLI surface. The bind path stays untouched.
- Covering every remote-access method. Containers, `tmux` over a serial console, and browser-based shells are out of scope; a missed detection costs the user nothing they do not already lack today.

## Decisions

**Detect via `SSH_CONNECTION`, falling back to `SSH_TTY`/`SSH_CLIENT`.**
`SSH_CONNECTION` is set by `sshd` in the session environment and holds `<client-ip> <client-port> <server-ip> <server-port>`. Its third field is the address the client already successfully reached this machine on, which is exactly the address to put in the command — no interface enumeration, no guessing between a LAN address and a public one. `SSH_TTY` and `SSH_CLIENT` are the fallbacks for detection when `SSH_CONNECTION` is absent or malformed.

*Alternative considered:* enumerate interfaces with `os.networkInterfaces()` and pick a non-internal address. Rejected — on a host with several interfaces there is no way to tell which one the user came in on, so it would print a plausible wrong address. `SSH_CONNECTION` is a fact about this session rather than an inference.

**Print the user and host when known, a placeholder when not.**
The command is `ssh -L <port>:localhost:<port> <user>@<server-ip>`, with `<user>` from `USER`/`LOGNAME`. When the server address cannot be parsed out, the command degrades to `<user>@<host>` placeholders rather than being suppressed — a shape the user can complete beats silence, since the non-obvious part is the `-L` mapping, not their own hostname.

**Detect nothing about VS Code Remote-SSH specifically.**
Those sessions forward the port automatically and the plain `localhost` URL already works, but they also set `SSH_CONNECTION`, so they will see the hint. Printing a redundant line there is cheaper than a fragile check for an editor-managed session, and the hint is accurate even when redundant.

**Keep it inside `startServer`'s banner.**
Same `console.log` region, after the URL and project lines. No new module: the whole feature is reading two environment variables and formatting a string.

## Risks / Trade-offs

- **Noise for users whose port is already forwarded** (VS Code, `tmux` inside a forwarded session) → the hint is one indented line below an existing blank-line-padded banner, and it is correct advice rather than wrong advice.
- **`SSH_CONNECTION` survives into unexpected children** (a detached process, a nested shell that outlived the session) → worst case is a stale hint alongside a URL that is correct anyway; nothing the reader does depends on the detection.
- **A user reads the hint as permission to expose the reader** → the line describes forwarding, not binding, and the spec keeps the loopback requirement intact so the next reader of the spec sees both together.
