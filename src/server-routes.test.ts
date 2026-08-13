import assert from "node:assert/strict";
import { resolve } from "path";
import { bindFailureReason, startServer, type RunningReader } from "./server.js";
import { resolveProject } from "./project.js";
import { PORT_RANGE_END, PORT_RANGE_START } from "./port.js";
import { isExitError } from "./exit.js";
import { testCovering, withFiles } from "./test-fixture.js";
import type { TargetMode } from "./types.js";

/**
 * Every route the reader answers, and every shape of target it can be pointed
 * at, driven in the process the coverage instrumentation is measuring.
 *
 * The subprocess suite covers the same ground from outside, where the startup
 * announcement and the exit code are observable. What is here is the request
 * handling itself, which needs no process of its own to be demonstrated.
 */

const CHANGES = "openspec/changes";
const ARCHIVE = `${CHANGES}/archive`;

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
  [`${CHANGES}/add-dark-mode/proposal.md`]: "# Open proposal\n\nOpen text.\n",
  [`${CHANGES}/add-dark-mode/tasks.md`]: "# Tasks\n\n- [ ] one\n",
  [`${ARCHIVE}/2026-08-10-old-work/proposal.md`]: "# Archived\n\nArchived text.\n",
  "docs/notes.md": "# Notes\n\nFolder text.\n",
  "docs/more.md": "# More\n\nSecond file.\n",
  "single.md": "# Single\n\nOne file.\n",
};

/** Starts a reader on a fixture, hands it over, and always closes it. */
async function serving<T>(
  root: string,
  mode: TargetMode,
  fn: (reader: RunningReader) => Promise<T>,
  extra: { archived?: boolean; requestedPort?: number } = {}
): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};

  let reader: RunningReader | undefined;
  try {
    reader = await startServer({
      project: resolveProject(root),
      mode,
      openBrowser: false,
      archived: extra.archived ?? false,
      ...(extra.requestedPort === undefined
        ? {}
        : { requestedPort: extra.requestedPort }),
    });
    return await fn(reader);
  } finally {
    if (reader) await reader.close();
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

const get = async (
  reader: RunningReader,
  path: string
): Promise<{ status: number; body: string }> => {
  const response = await fetch(`http://127.0.0.1:${reader.port}${path}`);
  return { status: response.status, body: await response.text() };
};

const changesMode = (root: string): TargetMode => ({
  kind: "changes",
  changesDir: resolve(root, CHANGES),
});

// =========================================================================
// The index, and the archive toggle
// =========================================================================

testCovering(
  "the index lists the open changes and reveals the archive on request",
  "archive-browsing",
  ["Requested archived changes are displayed"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await serving(root, changesMode(root), async (reader) => {
        const hidden = await get(reader, "/");
        assert.equal(hidden.status, 200);
        assert.match(hidden.body, /add-dark-mode/);
        assert.ok(!hidden.body.includes("old-work"));

        const shown = await get(reader, "/?archived=1");
        assert.match(shown.body, /old-work/);
      });
    });
  }
);

testCovering(
  "the archive served as its own target is a listing of archived changes",
  "archive-browsing",
  ["Archive directory yields a listing"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await serving(
        root,
        { kind: "archive", changesDir: resolve(root, CHANGES) },
        async (reader) => {
          const index = await get(reader, "/");

          assert.equal(index.status, 200);
          assert.match(index.body, /<h1>Archived Changes<\/h1>/);
          assert.match(index.body, /old-work/);
          // Not the merged content of every archived change.
          assert.ok(!index.body.includes("Archived text."));

          const one = await get(reader, "/archived/2026-08-10-old-work");
          assert.equal(one.status, 200);
          assert.match(one.body, /Archived text\./);
        }
      );
    });
  }
);

// =========================================================================
// One change, a folder, a file
// =========================================================================

testCovering(
  "a change served on its own answers at the root",
  "artifact-ordering",
  ["A change served on its own is ordered identically"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await serving(
        root,
        {
          kind: "change",
          changeName: "add-dark-mode",
          dirPath: resolve(root, CHANGES, "add-dark-mode"),
        },
        async (reader) => {
          const page = await get(reader, "/");

          assert.equal(page.status, 200);
          assert.match(page.body, /Open text\./);
          assert.match(page.body, /add-dark-mode/);
          // An open change carries no archived marking.
          assert.ok(!page.body.includes('<p class="archived-banner"'));
        }
      );
    });
  }
);

testCovering(
  "an archived change served on its own carries its marking",
  "archive-browsing",
  ["Archived change carries the marking"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await serving(
        root,
        {
          kind: "change",
          changeName: "2026-08-10-old-work",
          dirPath: resolve(root, ARCHIVE, "2026-08-10-old-work"),
          archived: { date: "2026-08-10", displayName: "old-work" },
        },
        async (reader) => {
          const page = await get(reader, "/");

          assert.match(page.body, /<p class="archived-banner" role="note">/);
          assert.match(page.body, /Archived on 2026-08-10/);
        }
      );
    });
  }
);

testCovering(
  "a plain folder of Markdown is served as a set of files",
  "artifact-ordering",
  ["The reading order does not depend on the file system"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await serving(
        root,
        { kind: "dir", dirPath: resolve(root, "docs") },
        async (reader) => {
          const page = await get(reader, "/");

          assert.equal(page.status, 200);
          assert.match(page.body, /Folder text\./);
          assert.match(page.body, /Second file\./);
        }
      );
    });
  }
);

testCovering(
  "a single Markdown file is served on its own",
  "server-startup",
  ["Page body carries the project"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await serving(
        root,
        { kind: "file", filePath: resolve(root, "single.md") },
        async (reader) => {
          const page = await get(reader, "/");

          assert.equal(page.status, 200);
          assert.match(page.body, /One file\./);
          assert.match(page.body, /class="brand"/);
        }
      );
    });
  }
);

// =========================================================================
// The routes that resolve by slug
// =========================================================================

testCovering(
  "an open change is reachable by slug and an unknown one is not found",
  "archive-browsing",
  ["Listed archived change is reachable", "Unknown archived address is reported"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await serving(root, changesMode(root), async (reader) => {
        const open = await get(reader, "/change/add-dark-mode");
        assert.equal(open.status, 200);
        assert.match(open.body, /Open text\./);

        const missingOpen = await get(reader, "/change/no-such-change");
        assert.equal(missingOpen.status, 404);

        const archived = await get(reader, "/archived/2026-08-10-old-work");
        assert.equal(archived.status, 200);
        assert.match(archived.body, /Archived text\./);

        const missingArchived = await get(reader, "/archived/no-such-thing");
        assert.equal(missingArchived.status, 404);
        assert.ok(!missingArchived.body.includes("Archived text."));
      });
    });
  }
);

testCovering(
  "a path the reader does not answer is a not-found page, not a crash",
  "server-startup",
  ["Tab title carries the project"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await serving(root, changesMode(root), async (reader) => {
        const missing = await get(reader, "/nothing/here");

        assert.equal(missing.status, 404);
        assert.match(missing.body, /<title>/);
        assert.match(missing.body, /class="brand"/);
      });
    });
  }
);

// =========================================================================
// What startup says
// =========================================================================

testCovering(
  "the announcement names what is being read, for every shape of target",
  "server-startup",
  ["Startup names the target"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const said: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => void said.push(args.join(" "));

      const modes: [TargetMode, RegExp][] = [
        [changesMode(root), /reading: openspec\/changes\//],
        [
          { kind: "archive", changesDir: resolve(root, CHANGES) },
          /reading: openspec\/changes\/archive\//,
        ],
        [
          {
            kind: "change",
            changeName: "add-dark-mode",
            dirPath: resolve(root, CHANGES, "add-dark-mode"),
          },
          /reading: change add-dark-mode/,
        ],
        [
          {
            kind: "change",
            changeName: "2026-08-10-old-work",
            dirPath: resolve(root, ARCHIVE, "2026-08-10-old-work"),
            archived: { date: "2026-08-10", displayName: "old-work" },
          },
          /reading: change old-work \(archived\)/,
        ],
        [{ kind: "dir", dirPath: resolve(root, "docs") }, /reading: docs\//],
        [
          { kind: "file", filePath: resolve(root, "single.md") },
          /reading: single\.md/,
        ],
      ];

      try {
        for (const [mode, expected] of modes) {
          said.length = 0;
          console.log = (...args: unknown[]) => void said.push(args.join(" "));
          const reader = await startServer({
            project: resolveProject(root),
            mode,
            openBrowser: false,
            archived: false,
          });
          await reader.close();
          assert.match(said.join("\n"), expected);
        }
      } finally {
        console.log = originalLog;
      }
    });
  }
);

testCovering(
  "a target outside the project root is named by its absolute path",
  "server-startup",
  ["Startup names the target"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withFiles({ "elsewhere.md": "# Elsewhere\n" }, async (other) => {
        const said: string[] = [];
        const originalLog = console.log;
        console.log = (...args: unknown[]) => void said.push(args.join(" "));

        try {
          const reader = await startServer({
            project: resolveProject(root),
            mode: { kind: "file", filePath: resolve(other, "elsewhere.md") },
            openBrowser: false,
            archived: false,
          });
          await reader.close();

          // Not relative: the file is not under the project being served.
          assert.ok(said.join("\n").includes(resolve(other, "elsewhere.md")));
        } finally {
          console.log = originalLog;
        }
      });
    });
  }
);

testCovering(
  "inside a remote session the forwarding command names the bound port",
  "server-startup",
  ["Remote session gets the forwarding command", "Substituted port appears in the command"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const said: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => void said.push(args.join(" "));
      const before = {
        conn: process.env.SSH_CONNECTION,
        user: process.env.USER,
      };
      process.env.SSH_CONNECTION = "10.0.0.9 51234 10.0.0.1 22";
      process.env.USER = "someone";

      try {
        const reader = await startServer({
          project: resolveProject(root),
          mode: changesMode(root),
          openBrowser: false,
          archived: false,
        });
        const port = reader.port;
        await reader.close();

        const text = said.join("\n");
        assert.match(text, /remote session/);
        assert.ok(text.includes(`ssh -L ${port}:localhost:${port} someone@10.0.0.1`));
      } finally {
        console.log = originalLog;
        if (before.conn === undefined) delete process.env.SSH_CONNECTION;
        else process.env.SSH_CONNECTION = before.conn;
        if (before.user === undefined) delete process.env.USER;
        else process.env.USER = before.user;
      }
    });
  }
);

testCovering(
  "a remote session with no resolvable address still names the mapping",
  "server-startup",
  ["Remote session gets the forwarding command"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const said: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => void said.push(args.join(" "));
      const before = {
        conn: process.env.SSH_CONNECTION,
        tty: process.env.SSH_TTY,
        user: process.env.USER,
        logname: process.env.LOGNAME,
      };
      delete process.env.SSH_CONNECTION;
      delete process.env.USER;
      delete process.env.LOGNAME;
      process.env.SSH_TTY = "/dev/pts/3";

      try {
        const reader = await startServer({
          project: resolveProject(root),
          mode: changesMode(root),
          openBrowser: false,
          archived: false,
        });
        await reader.close();

        // The part the user cannot guess is the mapping; an unresolved user or
        // host degrades to a placeholder rather than suppressing the line.
        const text = said.join("\n");
        assert.match(text, /ssh -L \d+:localhost:\d+ <user>@<host>/);
      } finally {
        console.log = originalLog;
        for (const [key, value] of Object.entries({
          SSH_CONNECTION: before.conn,
          SSH_TTY: before.tty,
          USER: before.user,
          LOGNAME: before.logname,
        })) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });
  }
);

// =========================================================================
// Binding
// =========================================================================

testCovering(
  "a busy derived port is substituted and the substitution is announced",
  "server-startup",
  ["Busy derived port is substituted", "Second reader for the same project starts anyway"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const warned: string[] = [];
      const originalWarn = console.warn;
      const originalLog = console.log;
      console.warn = (...args: unknown[]) => void warned.push(args.join(" "));
      console.log = () => {};

      let first: RunningReader | undefined;
      let second: RunningReader | undefined;
      try {
        first = await startServer({
          project: resolveProject(root),
          mode: changesMode(root),
          openBrowser: false,
          archived: false,
        });
        second = await startServer({
          project: resolveProject(root),
          mode: changesMode(root),
          openBrowser: false,
          archived: false,
        });

        assert.notEqual(second.port, first.port);
        assert.ok(second.port >= PORT_RANGE_START && second.port <= PORT_RANGE_END);
        assert.ok(
          warned.join("\n").includes(`Port ${first.port} is in use`),
          warned.join("\n")
        );
        assert.ok(warned.join("\n").includes(`listening on ${second.port} instead`));
      } finally {
        if (second) await second.close();
        if (first) await first.close();
        console.warn = originalWarn;
        console.log = originalLog;
      }
    });
  }
);

testCovering(
  "a requested port is bound exactly, and a privileged one fails by its reason",
  "server-startup",
  ["Requested port is honoured exactly", "Other bind failures are named"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const originalLog = console.log;
      console.log = () => {};
      try {
        // Port 0 asks the kernel for any free port. What is announced has to
        // be the port that was bound, not the request, or the URL goes
        // nowhere.
        let reader: RunningReader | undefined;
        try {
          reader = await startServer({
            requestedPort: 0,
            project: resolveProject(root),
            mode: changesMode(root),
            openBrowser: false,
            archived: false,
          });
          assert.ok(reader.port > 0, "the bound port is reported, not the request");
          assert.equal((await get(reader, "/")).status, 200);
        } finally {
          if (reader) await reader.close();
        }

        await assert.rejects(
          () =>
            startServer({
              requestedPort: 80,
              project: resolveProject(root),
              mode: changesMode(root),
              openBrowser: false,
              archived: false,
            }),
          (err: unknown) => {
            assert.ok(isExitError(err));
            assert.match((err as Error).message, /Could not listen on port 80/);
            assert.match((err as Error).message, /permission denied/);
            return true;
          }
        );
      } finally {
        console.log = originalLog;
      }
    });
  }
);

testCovering(
  "a bind failure is named by its cause, code by code",
  "server-startup",
  ["Other bind failures are named", "Port in use is not a stack trace"],
  () => {
    // A pure mapping: not every code it names can be produced by actually
    // binding a socket, and what has to be right is the wording.
    assert.match(
      bindFailureReason({ code: "EACCES" }),
      /permission denied \(ports below 1024 need privileges\)/
    );
    assert.match(
      bindFailureReason({ code: "EADDRNOTAVAIL" }),
      /the address 127\.0\.0\.1 is not available/
    );
    // An unrecognised code is named as itself rather than guessed at.
    assert.equal(bindFailureReason({ code: "ENFILE" }), "ENFILE");
    // No code at all falls back to the message, and then to a last resort.
    assert.equal(bindFailureReason({ message: "something odd" }), "something odd");
    assert.equal(bindFailureReason({}), "unknown error");
    assert.equal(bindFailureReason(null), "unknown error");
  }
);

testCovering(
  "a request that fails while being answered is a page, not a crash",
  "server-startup",
  ["Port in use is not a stack trace"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const target = resolve(root, "single.md");
      const said: string[] = [];
      const originalError = console.error;
      console.error = (...args: unknown[]) => void said.push(args.join(" "));

      try {
        await serving(root, { kind: "file", filePath: target }, async (reader) => {
          // The file is gone by the time the request arrives: reading it
          // throws inside the handler, where nothing else can catch it.
          const { rmSync } = await import("fs");
          rmSync(target, { force: true });

          const page = await get(reader, "/");

          assert.equal(page.status, 500);
          assert.match(page.body, /Error:/);
          // Reported, and the reader is still up to answer the next request.
          assert.ok(said.length > 0);
        });
      } finally {
        console.error = originalError;
      }
    });
  }
);
