## 1. Project identity

- [x] 1.1 Add a project-root resolver that walks up from the working directory for the nearest directory owning `openspec/`, then for the nearest repository root, then falls back to the working directory
- [x] 1.2 Normalize the resolved root once — absolute, symlinks resolved, trailing separator stripped — and return that single value for both port derivation and naming
- [x] 1.3 Derive the project display name from the resolved root's basename, not from `package.json`
- [x] 1.4 Carry the project identity into `ServerOptions` in `src/types.ts`, and change the port field to an optional requested port rather than an already-resolved number

## 2. Port derivation

- [x] 2.1 Implement a 32-bit FNV-1a hash over the UTF-8 bytes of the normalized root path, with no dependency
- [x] 2.2 Map the hash into the 4242–4999 range and expose the range bounds as named constants used by both derivation and the exhaustion message
- [x] 2.3 Verify determinism: the same path yields the same port across runs, and the root path resolved from a subdirectory yields the same port as from the project root

## 3. Binding and failure handling

- [x] 3.1 Attach an `error` listener to the server before calling `listen`, and distinguish `EADDRINUSE` from every other bind error
- [x] 3.2 For a derived port, probe forward from the preferred port within the range, wrapping, up to a bounded number of candidates, and bind the first one that is free
- [x] 3.3 For a requested port, bind or fail — never probe — with an error naming the port and stating that omitting `--port` lets the reader choose
- [x] 3.4 Report range exhaustion with the range that was tried and a pointer to `--port`, exiting with code 1
- [x] 3.5 Report non-`EADDRINUSE` bind failures by their own cause, exiting with code 1, with no stack trace on any path
- [x] 3.6 Keep the bind on `127.0.0.1` for both derived and requested ports

## 4. CLI surface

- [x] 4.1 Remove `DEFAULT_PORT` as the Commander default for `-p, --port` so an omitted option arrives as absent rather than as `4242`
- [x] 4.2 Keep `parsePort` rejecting non-numeric values as a usage error, without falling back to automatic selection
- [x] 4.3 Update the option description and the help text so the port reads as an override and the automatic choice is stated
- [x] 4.4 Resolve the project identity in `src/cli.ts` and pass it into `startServer` alongside the optional requested port

## 5. Identification

- [x] 5.1 Print the project name and the target being read alongside the bound URL in the startup banner
- [x] 5.2 Print the fallback notice when the bound port is not the derived one, naming both the derived port and the port actually bound
- [x] 5.3 Thread the project name into `src/renderer.ts` and include it in `pageShell`'s `<title>`
- [x] 5.4 Show the project name in the page header on every rendered page, including the index, a change page, a folder listing, and a single file

## 6. Verification

- [x] 6.1 Start two readers in different projects with no options and confirm both bind without a flag, each naming its own project
- [x] 6.2 Start a reader, stop it, start it again, and confirm the same URL is served
- [x] 6.3 Run from a subdirectory and from the project root and confirm the same port
- [x] 6.4 Occupy the derived port with an unrelated process and confirm the fallback binds elsewhere and announces both ports
- [x] 6.5 Occupy a port and request it with `--port` and confirm a guided error and exit code 1, with no stack trace
- [x] 6.6 Confirm `--port 4242` still reproduces the previous address exactly
- [x] 6.7 Update `README.md` where it documents the default port
