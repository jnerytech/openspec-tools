import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { collectMarkdownFiles, scanChanges } from "./scanner.js";
import { renderChange, renderFiles } from "./renderer.js";
import { withTree, tocNames, testCovering } from "./test-fixture.js";
import type { Change } from "./types.js";

const EVERY_ARTIFACT = [
  "summary.md",
  "proposal.md",
  "design.md",
  "tasks.md",
  "review.md",
  "specs/artifact-ordering/spec.md",
];

const READING_ORDER = [
  "summary",
  "proposal",
  "spec",
  "design",
  "tasks",
  "review",
];

function change(dirPath: string, artifacts: Change["artifacts"]): Change {
  return { name: "a-change", slug: "a-change", dirPath, artifacts };
}

/**
 * The regression this suite exists for: the order was applied by the scanner,
 * so the route that built a change without scanning rendered the directory's
 * own order. Handing the renderer a deliberately reversed list - rather than
 * whatever `readdir` returns - keeps the case from passing by luck.
 */
testCovering(
  "renderChange orders the artifacts it is handed",
  "artifact-ordering",
  ["The reading order does not depend on the file system"],
  async () => {
    await withTree(EVERY_ARTIFACT, async (dir) => {
      const unordered = (await collectMarkdownFiles(dir)).sort((a, b) =>
        b.name.localeCompare(a.name)
      );

      const html = await renderChange("proj", change(dir, unordered));

      assert.deepEqual(tocNames(html), READING_ORDER);
    });
  }
);

testCovering(
  "a change served on its own is ordered like one opened from the list",
  "artifact-ordering",
  ["A change served on its own is ordered identically"],
  async () => {
    await withTree(
      EVERY_ARTIFACT.map((rel) => join("a-change", rel)),
      async (changesDir) => {
        const dir = join(changesDir, "a-change");

        // How the reader builds a change when pointed straight at it.
        const served = await renderChange(
          "proj",
          change(dir, await collectMarkdownFiles(dir))
        );

        // How it builds the same change when opened from the index.
        const scanned = (await scanChanges(changesDir))[0];
        const listed = await renderChange("proj", scanned);

        assert.deepEqual(tocNames(served), READING_ORDER);
        assert.deepEqual(tocNames(served), tocNames(listed));
      }
    );
  }
);

testCovering(
  "renderFiles orders a plain folder of Markdown the same way",
  "artifact-ordering",
  ["The reading order does not depend on the file system"],
  async () => {
    await withTree(EVERY_ARTIFACT, async (dir) => {
      const unordered = (await collectMarkdownFiles(dir)).sort((a, b) =>
        b.name.localeCompare(a.name)
      );

      const html = await renderFiles("proj", unordered, "a folder");

      assert.deepEqual(tocNames(html), READING_ORDER);
    });
  }
);

/**
 * No scenario of `artifact-ordering` names this: it is a property of the
 * implementation - ordering a copy - rather than of the reading order the
 * capability specifies. Declaring a scenario here would claim cover the spec
 * does not ask for, so the test stays a plain one.
 */
test("rendering does not reorder the caller's own array", async () => {
  await withTree(EVERY_ARTIFACT, async (dir) => {
    const unordered = (await collectMarkdownFiles(dir)).sort((a, b) =>
      b.name.localeCompare(a.name)
    );
    const before = unordered.map((a) => a.name);

    await renderChange("proj", change(dir, unordered));

    assert.deepEqual(
      unordered.map((a) => a.name),
      before
    );
  });
});
