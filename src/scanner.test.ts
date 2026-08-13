import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { scanChanges, scanArchivedChanges } from "./scanner.js";
import { withTree, names } from "./test-fixture.js";

/** Lays the given files out inside a change, under a changes directory. */
function change(name: string, artifacts: string[]): string[] {
  return artifacts.map((rel) => join(name, rel));
}

test("a change carrying every artifact is presented in the reading order", async () => {
  await withTree(
    change("full", [
      "summary.md",
      "proposal.md",
      "design.md",
      "tasks.md",
      "review.md",
      "specs/artifact-ordering/spec.md",
    ]),
    async (changesDir) => {
      const [scanned] = await scanChanges(changesDir);

      assert.deepEqual(names(scanned.artifacts), [
        "summary",
        "proposal",
        "spec",
        "design",
        "tasks",
        "review",
      ]);
    }
  );
});

test("absent artifacts leave no gap", async () => {
  await withTree(
    change("partial", [
      "proposal.md",
      "tasks.md",
      "specs/artifact-ordering/spec.md",
    ]),
    async (changesDir) => {
      const [scanned] = await scanChanges(changesDir);

      assert.deepEqual(names(scanned.artifacts), ["proposal", "spec", "tasks"]);
    }
  );
});

test("an artifact the order does not name is presented last, separating none", async () => {
  await withTree(
    change("extra", [
      "proposal.md",
      "tasks.md",
      "notes.md",
      "specs/artifact-ordering/spec.md",
    ]),
    async (changesDir) => {
      const [scanned] = await scanChanges(changesDir);

      assert.deepEqual(names(scanned.artifacts), [
        "proposal",
        "spec",
        "tasks",
        "notes",
      ]);
    }
  );
});

test("several spec files keep one stable sequence across repeated scans", async () => {
  await withTree(
    change("many-specs", [
      "proposal.md",
      "specs/server-startup/spec.md",
      "specs/artifact-ordering/spec.md",
      "specs/cli-interface/spec.md",
      "specs/archive-browsing/spec.md",
    ]),
    async (changesDir) => {
      const first = (await scanChanges(changesDir))[0].artifacts;
      const second = (await scanChanges(changesDir))[0].artifacts;

      // Four spec files of equal rank: the tie-break, not readdir, decides.
      assert.equal(first.length, 5);
      assert.deepEqual(
        first.map((a) => a.slug),
        second.map((a) => a.slug)
      );
      assert.deepEqual(names(first), [
        "proposal",
        "spec",
        "spec",
        "spec",
        "spec",
      ]);
    }
  );
});

test("an archived change is ordered like an open one holding the same artifacts", async () => {
  const artifacts = [
    "summary.md",
    "proposal.md",
    "design.md",
    "tasks.md",
    "specs/artifact-ordering/spec.md",
  ];

  await withTree(
    [
      ...change("open-one", artifacts),
      ...change("archive/2026-01-02-archived-one", artifacts),
    ],
    async (changesDir) => {
      const [open] = await scanChanges(changesDir);
      const [archived] = await scanArchivedChanges(changesDir);

      assert.deepEqual(names(open.artifacts), names(archived.artifacts));
      assert.deepEqual(names(open.artifacts), [
        "summary",
        "proposal",
        "spec",
        "design",
        "tasks",
      ]);
    }
  );
});
