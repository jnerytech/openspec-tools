import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { REPO_ROOT, scenarioKey } from "./scenarios.js";
import { readDeclared, RECORD_PATH } from "./verify.js";
import { testCovering } from "../test-fixture.js";

/**
 * That the correspondence between a scenario and the test covering it is
 * derived, and lives nowhere that could go stale.
 *
 * Shown by running a test file twice - once declaring a scenario, once with the
 * declaration taken out - and observing that what the run reports changes with
 * no other file edited anywhere. A mapping kept beside the code would have
 * needed a second edit to stay true, and would have stayed wrong without one.
 */

/**
 * The compiled fixture, which is what the suite itself now runs against. The
 * probe is plain JavaScript for the same reason: it has to be executable by
 * `node` directly, with no transform between the source and what runs.
 */
const FIXTURE = join(REPO_ROOT, ".tscheck", "test-fixture.js");

/** The parent's environment minus what marks it as a running test. */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  return env;
}

/** Runs one throwaway test file and returns what it declared. */
function declarationsOf(body: string): Set<string> {
  const dir = mkdtempSync(join(tmpdir(), "opsx-derived-"));
  try {
    const file = join(dir, "probe.test.js");
    writeFileSync(file, body, "utf8");
    const out = join(dir, "collected");

    const result = spawnSync(
      process.execPath,
      ["--test", file],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        // Node refuses to start a test run inside one, and the marker for
        // "inside one" is inherited through the environment. Cleared, so the
        // child is an ordinary run rather than a recursive one.
        env: {
          ...childEnv(),
          OPSX_COVERAGE_DIR: out,
        },
      }
    );
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);

    return readDeclared(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const WITH_DECLARATION = `
import assert from "node:assert/strict";
import { testCovering } from ${JSON.stringify(FIXTURE)};

testCovering(
  "a probe that declares what it covers",
  "artifact-ordering",
  ["Orientation leads"],
  () => {
    assert.ok(true);
  }
);
`;

const WITHOUT_DECLARATION = `
import { test } from "node:test";
import assert from "node:assert/strict";

test("a probe that declares nothing", () => {
  assert.ok(true);
});
`;

testCovering(
  "the correspondence is derived from the run, not read out of a file",
  "quality-gates",
  ["A correspondência não é mantida à parte"],
  () => {
    const declaring = declarationsOf(WITH_DECLARATION);
    const key = scenarioKey("artifact-ordering", "Orientation leads");
    assert.ok(declaring.has(key));

    // The same scenario, with the declaring test gone. Nothing else was
    // edited - no map, no index, no list of test names anywhere.
    const silent = declarationsOf(WITHOUT_DECLARATION);
    assert.ok(!silent.has(key));
    assert.equal(silent.size, 0);
  }
);

testCovering(
  "the versioned record holds scenarios, never the tests that cover them",
  "quality-gates",
  ["A correspondência não é mantida à parte"],
  () => {
    const record = readFileSync(RECORD_PATH, "utf8");

    // The record is the covered *set*, which is what a regression is measured
    // against. It names no test, no file and no line, so it cannot be the
    // mapping and cannot drift from one.
    assert.ok(!record.includes(".test.ts"));
    assert.ok(!/\bsrc\//.test(record));
    assert.ok(!/\btest\(/.test(record));

    const parsed = JSON.parse(record) as { covered: Record<string, string[]> };
    const specs = new Set(Object.keys(parsed.covered));
    assert.ok(specs.size > 0);
    for (const titles of Object.values(parsed.covered)) {
      for (const title of titles) assert.equal(typeof title, "string");
    }
  }
);
