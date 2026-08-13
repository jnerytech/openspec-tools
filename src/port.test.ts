import { test } from "node:test";
import assert from "node:assert/strict";
import {
  derivePort,
  fnv1a32,
  PORT_RANGE_END,
  PORT_RANGE_SIZE,
  PORT_RANGE_START,
} from "./port.js";
import { testCovering } from "./test-fixture.js";

/**
 * A pure function of the project root, stored nowhere. The properties that
 * matter to a user are that the same project keeps its address, that the
 * address is in the announced range, and that nothing on disk has to be kept
 * in step for either to hold.
 */

const PATHS = [
  "/home/dev/repos/openspec-tools",
  "/home/dev/repos/other",
  "/",
  "/a",
  "/home/dev/repos/openspec-tools/nested/deeper",
  "/home/dev/repos/acentuação",
];

testCovering(
  "the same project path always derives the same port",
  "server-startup",
  ["Same project yields the same port"],
  () => {
    for (const path of PATHS) {
      assert.equal(derivePort(path), derivePort(path), path);
    }
  }
);

testCovering(
  "different project paths derive different ports",
  "server-startup",
  ["Different projects yield different ports"],
  () => {
    const ports = PATHS.map(derivePort);

    assert.equal(
      new Set(ports).size,
      PATHS.length,
      `these paths must not collide: ${JSON.stringify(ports)}`
    );
  }
);

testCovering(
  "every derived port falls inside the declared range",
  "server-startup",
  ["Derived port stays in range"],
  () => {
    // Not only the handful above: a wide sweep, because the range is enforced
    // by a modulo and an off-by-one there would only show at the edges.
    for (let i = 0; i < 5000; i++) {
      const port = derivePort(`/some/project/path/${i}`);
      assert.ok(
        port >= PORT_RANGE_START && port <= PORT_RANGE_END,
        `${port} is outside ${PORT_RANGE_START}..${PORT_RANGE_END}`
      );
      assert.ok(Number.isInteger(port));
    }
  }
);

testCovering(
  "deriving a port reads and writes nothing, so repeated runs cannot drift",
  "server-startup",
  ["No state is persisted"],
  () => {
    // Called from a different working directory and a different environment,
    // the answer is the same: the path is the only input there is.
    const path = "/home/dev/repos/openspec-tools";
    const first = derivePort(path);

    const previousCwd = process.cwd();
    try {
      process.chdir("/");
      process.env.OPSX_TOOLS_PROBE = "1";
      assert.equal(derivePort(path), first);
    } finally {
      process.chdir(previousCwd);
      delete process.env.OPSX_TOOLS_PROBE;
    }
  }
);

test("the range starts at the port this tool used to hardcode", () => {
  // `--port 4242` still reproduces the old address exactly.
  assert.equal(PORT_RANGE_START, 4242);
  assert.equal(PORT_RANGE_END, 4999);
  assert.equal(PORT_RANGE_SIZE, PORT_RANGE_END - PORT_RANGE_START + 1);
});

test("the range sits above the privileged ports", () => {
  assert.ok(PORT_RANGE_START > 1024);
});

test("the hash is FNV-1a, 32-bit, over the UTF-8 bytes", () => {
  // The published offset basis, and the published first steps: this is what
  // makes the derived address stable across machines and Node versions.
  assert.equal(fnv1a32(""), 0x811c9dc5);
  assert.equal(fnv1a32("a"), 0xe40c292c);
  assert.equal(fnv1a32("foobar"), 0xbf9cf968);
});

test("the hash is taken over bytes, so a non-ASCII path is not truncated", () => {
  assert.notEqual(fnv1a32("acentuação"), fnv1a32("acentuaco"));
  assert.ok(fnv1a32("acentuação") >= 0);
  assert.ok(fnv1a32("acentuação") <= 0xffffffff);
});

test("a one-character difference in the path changes the port", () => {
  assert.notEqual(derivePort("/a/b/c"), derivePort("/a/b/d"));
});
