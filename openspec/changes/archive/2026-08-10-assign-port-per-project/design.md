## Context

See proposal.md — Why.

Four facts about the current code shape this design:

- `src/cli.ts` resolves a port eagerly through Commander's default value (`4242`) and hands `ServerOptions` a number that is already decided before anything knows whether it can be bound.
- `startServer` calls `server.listen(port, "127.0.0.1", …)` with no `error` listener attached, so a bind failure reaches the default `uncaughtException` path.
- The startup banner prints the URL and nothing else, and the page title is `<target> · openspec-tools`. Neither names the project, because until now there could only be one.
- The CLI already resolves paths relative to `process.cwd()` and assumes the user is at the project root — `resolveDefaultMode` warns when `openspec/changes/` is missing rather than searching for it.

## Goals / Non-Goals

**Goals:**

- The same project reaches the same URL on every run, so a browser tab stays valid across restarts of the reader.
- Nothing is persisted to disk to achieve that stability. The port is a pure function of the project's location.
- Every bind outcome — preferred port, fallback port, or no port at all — produces a sentence the user can act on.
- Two readers running side by side can be told apart without reading the URL.

**Non-Goals:**

- Detecting that a reader is already serving this project and attaching to it instead of starting a second one. The preferred port makes this possible later; it is not part of this change.
- Any registry, lock file, or shared state between reader processes.
- Serving on anything but the loopback interface. The port becomes less predictable to a human, not more private; the binding stays `127.0.0.1`.
- Changing whether the browser opens automatically. `--open` stays opt-in — see Open Questions.

## Decisions

### Project identity is a resolved root, not the working directory

The identity is the absolute, symlink-resolved path of the project root, found by walking up from the working directory for the first directory containing `openspec/`, then for the first containing `.git`, and finally falling back to the working directory itself.

Hashing `process.cwd()` directly would be one line shorter and wrong: running `opsx-read ../openspec/changes/foo` from `src/` would land on a different port than running it from the repository root, which destroys the one property this change exists to provide. Resolving symlinks matters for the same reason — a worktree reached through a symlinked path must not become a second project.

The same resolved root supplies the display name (its basename). Coupling them is deliberate: the thing that decides the port is the thing that gets named, so a user who sees two readers named `openspec-tools` and `my-api` knows the ports differ because the roots differ.

### The preferred port is derived, not stored

`preferredPort = 4242 + (fnv1a32(identityPath) % 758)`, giving the range 4242–4999.

- **FNV-1a, 32-bit**, over the UTF-8 bytes of the normalized path. It is a dozen lines, has no dependency, and is stable across machines and Node versions — which a `Math.random()` seed or `crypto` digest of convenience would not need to be, but which matters if the user ever writes the port down.
- **The range starts at the old default**, so the previous behaviour is still inside the space and `--port 4242` remains meaningful. It sits above the privileged range and clear of the ephemeral range Linux hands out for `listen(0)`, so an automatic choice cannot be stolen by an unrelated outbound socket.
- **758 slots** makes a collision between two projects a curiosity rather than a concern at the scale this tool operates at, and collisions degrade into the fallback rather than into failure.

Alternatives considered:

- **`server.listen(0)`.** One line, and it satisfies "never set a port again" literally. Rejected because every restart yields a new high-numbered port, so an open browser tab is invalidated by every Ctrl+C — the workflow this tool is built around.
- **Scan upward from a fixed base.** Predictable numbers, but which project gets 4242 depends on boot order, so the same project's URL changes depending on what else happens to be running.
- **A registry file mapping root to port.** Gives stability and enables reuse detection, but introduces shared mutable state between concurrent processes, stale entries for deleted repositories, and a file to garbage-collect — all to reproduce what a hash computes for free.

### An automatic port probes; an explicit port does not

When the port was derived, a busy preferred port is not an error: the server probes forward from it, wrapping within the range, up to a bounded number of candidates, and reports which port it settled on and that the preferred one was taken. Exhausting the candidates is a guided failure, not a stack trace.

When the user typed `--port`, a busy port fails immediately with an error naming the port and pointing at the automatic behaviour as the alternative. Silently binding 8081 after being asked for 8080 breaks the only reason to pass the flag — something else, a tunnel or a proxy or a bookmark, is expecting that exact number.

This requires attaching an `error` listener before `listen` and treating `EADDRINUSE` separately from every other bind error; a permissions failure on a privileged port is a different sentence.

### The project is named in three places

The startup banner gains a line identifying the project and the target. The page `<title>` gains the project name, so a row of browser tabs is legible. The page header shows it, so a screenshot or a read-aloud session carries its own context.

The name is the basename of the resolved root, not `package.json`'s `name` field. A `name` may be scoped, may not exist, may not resemble the directory the user thinks in, and is absent entirely when the target is a plain documentation folder — while the basename is always available and is what the user typed to get there.

### Fallback announcements are warnings, not silence

Landing on a port other than the preferred one is reported at startup with the reason. Without it, the one property being promised — this project is always at this URL — appears to break at random, and the user has no way to see that another process is holding the address.

## Risks / Trade-offs

- **Two projects hash to the same preferred port** → The second falls back and says so. Its URL is stable only while the first is running, which is the pre-existing behaviour, not a regression.
- **An unrelated process squats the preferred port** → Same fallback path, same announcement. The project returns to its preferred port once the squatter is gone.
- **Two readers for the same project at once** (two changes, two terminals) → A deliberate collision: identity is the project, not the target, so the second falls back. Naming the target in the banner is what keeps the two distinguishable.
- **The default port changes** → **BREAKING** for anyone with a `localhost:4242` bookmark or a script. Mitigated by keeping 4242 inside the range, by `--port 4242` restoring it exactly, and by the banner always printing the URL it actually bound.
- **Path normalization differs across platforms** (case, trailing separators, WSL versus Windows paths) → The same repository reached two ways would hash twice. Normalization happens once, in one function, and is the only place this can go wrong.
- **A hash-derived number looks arbitrary to the user** → The banner prints the URL and the project name together on every start, so the number never has to be remembered or explained.

## Open Questions

- Should `--open` become the default now that the port is not memorable? It would remove the last reason to read the terminal, but it changes the behaviour of an existing flag and can be decided independently — it touches no requirement in this change.
- Should a busy preferred port be probed to see whether it is *this project's* reader, and reported as "already running at …"? The derived port makes the check cheap; the check itself needs an identity endpoint, which is its own change.
