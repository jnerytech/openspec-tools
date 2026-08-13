import { test } from "node:test";
import assert from "node:assert/strict";
import { networkInterfaces } from "os";
import { derivePort, PORT_RANGE_END, PORT_RANGE_START } from "./port.js";
import { resolveProject } from "./project.js";
import {
  runReaderToExit,
  withPortHeld,
  withServer,
} from "./gate/cli-runner.js";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * The reader as a running process: what it binds, what it says it bound, and
 * what it refuses to do. Every case here starts a real server on the loopback
 * interface and kills it afterwards - the behaviour being specified is about
 * sockets, and nothing short of a socket demonstrates it.
 *
 * Each fixture is its own project root, so the derived port differs per case
 * and cases do not contend for the same address.
 */

const PROJECT = {
  "openspec/config.yaml": "schema: spec-driven\n",
  "openspec/changes/add-dark-mode/proposal.md": "# Proposal\n\nSome text.\n",
  "openspec/changes/add-dark-mode/tasks.md": "# Tasks\n\n- [ ] one\n",
};

/**
 * A port inside the range that is free right now and is not the one this
 * project derives. Probed rather than computed: test files run in parallel and
 * each starts its own readers, so an offset from the derived port is not a
 * guarantee that nothing else already holds it.
 */
async function freePortNear(root: string): Promise<number> {
  const { createServer } = await import("net");
  const derived = derivePort(resolveProject(root).root);
  const span = PORT_RANGE_END - PORT_RANGE_START + 1;

  for (let step = 1; step < span; step++) {
    const candidate = PORT_RANGE_START + ((derived - PORT_RANGE_START + step * 137) % span);
    if (candidate === derived) continue;

    const free = await new Promise<boolean>((settle) => {
      const probe = createServer();
      probe.once("error", () => settle(false));
      probe.listen(candidate, "127.0.0.1", () => probe.close(() => settle(true)));
    });
    if (free) return candidate;
  }

  throw new Error("no free port in the range to test a requested one with");
}

// =========================================================================
// What is announced
// =========================================================================

testCovering(
  "startup prints the bound URL and names the project and the target",
  "server-startup",
  ["Startup names the project", "Startup names the target"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read"], { cwd: root }, async (reader) => {
        const project = resolveProject(root);

        assert.match(reader.announcement, /http:\/\/localhost:\d+/);
        assert.ok(
          reader.announcement.includes(`project: ${project.name}`),
          reader.announcement
        );
        // What is being read, not only where it is being served.
        assert.match(reader.announcement, /reading: openspec\/changes\//);
      });
    });
  }
);

testCovering(
  "two readers for two projects each name their own project",
  "server-startup",
  ["Two readers are distinguishable"],
  async () => {
    await withFiles(PROJECT, async (one) => {
      await withFiles(PROJECT, async (two) => {
        await withServer(["read"], { cwd: one }, async (first) => {
          await withServer(["read"], { cwd: two }, async (second) => {
            const nameOne = resolveProject(one).name;
            const nameTwo = resolveProject(two).name;

            assert.notEqual(nameOne, nameTwo);
            assert.ok(first.announcement.includes(`project: ${nameOne}`));
            assert.ok(second.announcement.includes(`project: ${nameTwo}`));
            // Told apart without comparing ports.
            assert.ok(!first.announcement.includes(`project: ${nameTwo}`));
          });
        });
      });
    });
  }
);

testCovering(
  "a change served on its own names that change as the target",
  "server-startup",
  ["Startup names the target"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read", "add-dark-mode"], { cwd: root }, async (reader) => {
        assert.match(reader.announcement, /reading: change add-dark-mode/);
      });
    });
  }
);

// =========================================================================
// The port
// =========================================================================

testCovering(
  "a busy derived port is substituted, and the substitution is announced",
  "server-startup",
  ["Busy derived port is substituted", "Port in use is not a stack trace"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const derived = derivePort(resolveProject(root).root);

      await withPortHeld(derived, async () => {
        await withServer(["read"], { cwd: root }, async (reader) => {
          assert.notEqual(reader.port, derived);
          assert.ok(reader.port >= PORT_RANGE_START);
          assert.ok(reader.port <= PORT_RANGE_END);
          // Named, both the port that was wanted and the one settled on.
          assert.ok(reader.announcement.includes(`Port ${derived} is in use`));
          assert.ok(
            reader.announcement.includes(`listening on ${reader.port} instead`)
          );
          // A readable message, not a thrown error.
          assert.ok(!/at .*\(.*:\d+:\d+\)/.test(reader.announcement));
          assert.ok(!reader.announcement.includes("EADDRINUSE"));
        });
      });
    });
  }
);

testCovering(
  "a second reader for the same project starts anyway, elsewhere in the range",
  "server-startup",
  ["Second reader for the same project starts anyway"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read"], { cwd: root }, async (first) => {
        await withServer(["read"], { cwd: root }, async (second) => {
          assert.notEqual(second.port, first.port);
          assert.ok(second.port >= PORT_RANGE_START);
          assert.ok(second.port <= PORT_RANGE_END);
          // Both are actually serving.
          assert.equal((await first.get("/")).status, 200);
          assert.equal((await second.get("/")).status, 200);
        });
      });
    });
  }
);

testCovering(
  "a requested port is bound exactly, whatever the derived one would have been",
  "server-startup",
  ["Requested port is honoured exactly"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const wanted = await freePortNear(root);
      assert.notEqual(wanted, derivePort(resolveProject(root).root));

      await withServer(
        ["read", "--port", String(wanted)],
        { cwd: root },
        async (reader) => {
          assert.equal(reader.port, wanted);
          assert.equal((await reader.get("/")).status, 200);
          // Never announced as a substitution: nothing was substituted.
          assert.ok(!reader.announcement.includes("instead"));
        }
      );
    });
  }
);

testCovering(
  "a busy requested port is an error, and no server starts",
  "server-startup",
  ["Busy requested port is an error"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const wanted = await freePortNear(root);

      await withPortHeld(wanted, async () => {
        const result = await runReaderToExit(
          ["read", "--port", String(wanted)],
          { cwd: root }
        );

        assert.equal(result.code, 1);
        assert.ok(result.stderr.includes(`Port ${wanted} is already in use`));
        // Points at the automatic behaviour as the alternative.
        assert.match(result.stderr, /Omitting --port lets the reader choose/);
        // Never substituted: no other port is announced.
        assert.ok(!/http:\/\/localhost:\d+/.test(result.output));
        assert.ok(!/at .*\(.*:\d+:\d+\)/.test(result.stderr));
      });
    });
  }
);

testCovering(
  "a bind failure that is not a busy port names its own reason",
  "server-startup",
  ["Other bind failures are named", "Range exhausted fails with guidance"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      // A privileged port fails for permission, not for being held.
      const result = await runReaderToExit(["read", "--port", "80"], {
        cwd: root,
      });

      assert.equal(result.code, 1);
      assert.match(result.stderr, /Could not listen on port 80/);
      assert.match(result.stderr, /permission denied/);
      // Reported as its own cause, not as the port being in use.
      assert.ok(!result.stderr.includes("already in use"));
      assert.ok(!/at .*\(.*:\d+:\d+\)/.test(result.stderr));

      // The range-exhausted message is the same shape, and names the range
      // together with the option that resolves it. Exhausting 758 real ports
      // is not something a test may do, so the guidance is asserted on the
      // text the reader would print.
      const guidance = await runReaderToExit(["read", "--help"], { cwd: root });
      assert.match(
        guidance.stdout,
        new RegExp(`${PORT_RANGE_START}-${PORT_RANGE_END}`)
      );
      assert.match(guidance.stdout, /--port is never substituted/);
    });
  }
);

// =========================================================================
// Where it binds
// =========================================================================

/** Every non-loopback address this machine has, for the negative assertion. */
function externalAddresses(): string[] {
  const found: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) found.push(entry.address);
    }
  }
  return found;
}

async function reachableAt(host: string, port: number): Promise<boolean> {
  const { connect } = await import("net");
  return new Promise((settle) => {
    const socket = connect({ host, port });
    const done = (answer: boolean): void => {
      socket.destroy();
      settle(answer);
    };
    socket.setTimeout(1500, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

testCovering(
  "a derived port is reachable on loopback and on no external interface",
  "server-startup",
  ["Derived port binds loopback only"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read"], { cwd: root }, async (reader) => {
        assert.equal(await reachableAt("127.0.0.1", reader.port), true);

        for (const address of externalAddresses()) {
          assert.equal(
            await reachableAt(address, reader.port),
            false,
            `must not be reachable at ${address}`
          );
        }
      });
    });
  }
);

testCovering(
  "a requested port is reachable on loopback and on no external interface",
  "server-startup",
  ["Requested port binds loopback only"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const wanted = await freePortNear(root);

      await withServer(
        ["read", "--port", String(wanted)],
        { cwd: root },
        async (reader) => {
          assert.equal(await reachableAt("127.0.0.1", reader.port), true);
          for (const address of externalAddresses()) {
            assert.equal(await reachableAt(address, reader.port), false);
          }
        }
      );
    });
  }
);

// =========================================================================
// What every page carries
// =========================================================================

testCovering(
  "every served page carries the project in its title and in its body",
  "server-startup",
  ["Tab title carries the project", "Page body carries the project"],
  async () => {
    await withFiles(
      { ...PROJECT, "docs/notes.md": "# Notes\n\ntext\n" },
      async (root) => {
        const name = resolveProject(root).name;

        for (const args of [
          ["read"],
          ["read", "add-dark-mode"],
          ["read", "./docs"],
          ["read", "./docs/notes.md"],
        ]) {
          await withServer(args, { cwd: root }, async (reader) => {
            const { status, body } = await reader.get("/");

            assert.equal(status, 200, args.join(" "));
            const title = /<title>([^<]*)<\/title>/.exec(body)?.[1] ?? "";
            assert.ok(title.includes(name), `${args.join(" ")}: ${title}`);

            // The index brands with a span and the inner pages with a link
            // back to it; either way the name is in the header element.
            const brand = /class="brand"[^>]*>([^<]*)</.exec(body)?.[1] ?? "";
            assert.ok(
              brand.includes(name),
              `${args.join(" ")}: the page shows the project, got "${brand}"`
            );
          });
        }
      }
    );
  }
);

// =========================================================================
// A remote session
// =========================================================================

testCovering(
  "inside a remote session the forwarding command carries the bound port",
  "server-startup",
  ["Remote session gets the forwarding command", "Guidance does not widen the binding"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(
        ["read"],
        {
          cwd: root,
          env: {
            SSH_CONNECTION: "10.0.0.9 51234 10.0.0.1 22",
            USER: "someone",
          },
        },
        async (reader) => {
          assert.match(reader.announcement, /remote session/);
          assert.ok(
            reader.announcement.includes(
              `ssh -L ${reader.port}:localhost:${reader.port} someone@10.0.0.1`
            ),
            reader.announcement
          );

          // Printing the guidance does not widen what is bound.
          assert.equal(await reachableAt("127.0.0.1", reader.port), true);
          for (const address of externalAddresses()) {
            assert.equal(await reachableAt(address, reader.port), false);
          }
        }
      );
    });
  }
);

testCovering(
  "a substituted port is the one the forwarding command names",
  "server-startup",
  ["Substituted port appears in the command"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const derived = derivePort(resolveProject(root).root);

      await withPortHeld(derived, async () => {
        await withServer(
          ["read"],
          {
            cwd: root,
            env: { SSH_TTY: "/dev/pts/3", USER: "someone" },
          },
          async (reader) => {
            assert.notEqual(reader.port, derived);
            assert.ok(
              reader.announcement.includes(
                `ssh -L ${reader.port}:localhost:${reader.port}`
              )
            );
            // Not the port that was derived and could not be had.
            assert.ok(
              !reader.announcement.includes(`ssh -L ${derived}:localhost:`)
            );
          }
        );
      });
    });
  }
);

testCovering(
  "outside a remote session no forwarding command is printed",
  "server-startup",
  ["Local session is unchanged"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const child = { ...process.env };
      delete child.SSH_CONNECTION;
      delete child.SSH_TTY;
      delete child.SSH_CLIENT;

      await withServer(
        ["read"],
        { cwd: root, env: { SSH_CONNECTION: "", SSH_TTY: "", SSH_CLIENT: "" } },
        async (reader) => {
          assert.ok(!reader.announcement.includes("ssh -L"));
          assert.ok(!reader.announcement.includes("remote session"));
          // The URL and the project identification, as before.
          assert.match(reader.announcement, /http:\/\/localhost:\d+/);
          assert.match(reader.announcement, /project: /);
        }
      );
    });
  }
);

test("the reader serves the same project at the same port across restarts", async () => {
  await withFiles(PROJECT, async (root) => {
    const first = await withServer(["read"], { cwd: root }, async (r) => r.port);
    const second = await withServer(["read"], { cwd: root }, async (r) => r.port);

    assert.equal(first, second);
    assert.equal(first, derivePort(resolveProject(root).root));
  });
});
