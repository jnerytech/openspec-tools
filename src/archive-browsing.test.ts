import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import {
  ARCHIVE_DIR_NAME,
  parseArchivedDirName,
  scanArchivedChanges,
  scanChanges,
} from "./scanner.js";
import { renderChange, renderIndex } from "./renderer.js";
import { names, testCovering, withTree } from "./test-fixture.js";
import type { Change } from "./types.js";

/**
 * How completed work is kept apart from pending work: which directory becomes
 * an archived change, what its name says about when it was archived, the order
 * they are presented in, and the marking that keeps a finished task list from
 * being read as outstanding.
 */

const CHANGES = "openspec/changes";
const ARCHIVE = join(CHANGES, ARCHIVE_DIR_NAME);

/** Files of one archived change, laid out under the archive directory. */
const archived = (dirName: string, artifacts: string[]): string[] =>
  artifacts.map((rel) => join(ARCHIVE, dirName, rel));

const open = (name: string, artifacts: string[]): string[] =>
  artifacts.map((rel) => join(CHANGES, name, rel));

const VIEW_SHOWN = { current: true, initial: true };
const VIEW_HIDDEN = { current: false, initial: false };

// =========================================================================
// Each archived directory is one archived change
// =========================================================================

testCovering(
  "two archived directories are two archived changes, each with its own artifacts",
  "archive-browsing",
  ["Archived directories are listed individually", "Artifacts are not merged"],
  async () => {
    await withTree(
      [
        ...archived("2026-08-10-first", ["proposal.md", "tasks.md"]),
        ...archived("2026-01-05-second", ["proposal.md", "design.md"]),
      ],
      async (root) => {
        const changesDir = join(root, CHANGES);
        const found = await scanArchivedChanges(changesDir);

        assert.equal(found.length, 2);
        // Neither change carries the other's artifacts: the two are never
        // merged into one change holding every file in the archive.
        const first = found.find((c) => c.name === "2026-08-10-first");
        const second = found.find((c) => c.name === "2026-01-05-second");
        assert.deepEqual(names(first!.artifacts), ["proposal", "tasks"]);
        assert.deepEqual(names(second!.artifacts), ["proposal", "design"]);
      }
    );
  }
);

testCovering(
  "Markdown in a subdirectory belongs to its own archived change",
  "archive-browsing",
  ["Nested artifacts stay with their change"],
  async () => {
    await withTree(
      [
        ...archived("2026-08-10-first", [
          "proposal.md",
          "specs/cli-interface/spec.md",
        ]),
        ...archived("2026-01-05-second", ["proposal.md"]),
      ],
      async (root) => {
        const found = await scanArchivedChanges(join(root, CHANGES));

        const first = found.find((c) => c.name === "2026-08-10-first")!;
        const second = found.find((c) => c.name === "2026-01-05-second")!;
        assert.deepEqual(names(first.artifacts), ["proposal", "spec"]);
        assert.deepEqual(names(second.artifacts), ["proposal"]);
        assert.ok(
          first.artifacts.some((a) => a.filePath.includes("cli-interface"))
        );
      }
    );
  }
);

testCovering(
  "an archived subdirectory holding no Markdown is not listed",
  "archive-browsing",
  ["Directory without Markdown is skipped"],
  async () => {
    await withTree(
      [
        ...archived("2026-08-10-real", ["proposal.md"]),
        join(ARCHIVE, "2026-08-11-empty", "notes.txt"),
      ],
      async (root) => {
        const found = await scanArchivedChanges(join(root, CHANGES));

        assert.deepEqual(
          found.map((c) => c.name),
          ["2026-08-10-real"]
        );
      }
    );
  }
);

// =========================================================================
// The archive date comes from the directory name
// =========================================================================

testCovering(
  "a dated directory name yields the date and the display name",
  "archive-browsing",
  ["Dated directory yields date and name"],
  () => {
    assert.deepEqual(parseArchivedDirName("2026-08-10-improve-cli-error-guidance"), {
      date: "2026-08-10",
      displayName: "improve-cli-error-guidance",
    });
  }
);

testCovering(
  "a directory without a valid date prefix is still listed, under its whole name",
  "archive-browsing",
  ["Undated directory is still listed"],
  async () => {
    // A malformed prefix is not an error: the archive is user-owned and may
    // hold hand-moved directories.
    assert.deepEqual(parseArchivedDirName("just-a-name"), {
      displayName: "just-a-name",
    });
    assert.deepEqual(parseArchivedDirName("2026-13-45-impossible"), {
      displayName: "2026-13-45-impossible",
    });

    await withTree(archived("hand-moved", ["proposal.md"]), async (root) => {
      const [found] = await scanArchivedChanges(join(root, CHANGES));

      assert.equal(found.name, "hand-moved");
      assert.equal(found.archived?.displayName, "hand-moved");
      assert.equal(found.archived?.date, undefined);
    });
  }
);

testCovering(
  "a dated archived change shows its archive date in the listing",
  "archive-browsing",
  ["Archive date is visible"],
  async () => {
    await withTree(
      archived("2026-08-10-improve-cli", ["proposal.md"]),
      async (root) => {
        const changesDir = join(root, CHANGES);
        const archivedChanges = await scanArchivedChanges(changesDir);

        const html = renderIndex("proj", [], changesDir, {
          view: VIEW_SHOWN,
          archivedChanges,
        });

        assert.match(html, /Archived 2026-08-10/);
        assert.match(html, /improve-cli/);
      }
    );
  }
);

// =========================================================================
// Ordering
// =========================================================================

testCovering(
  "archived changes are ordered most recent first, undated ones last and stably",
  "archive-browsing",
  [
    "Newest archived change appears first",
    "Undated archived changes come last",
    "Ordering is stable",
  ],
  async () => {
    await withTree(
      [
        ...archived("2026-01-05-older", ["proposal.md"]),
        ...archived("2026-08-10-newer", ["proposal.md"]),
        ...archived("zzz-undated", ["proposal.md"]),
        ...archived("aaa-undated", ["proposal.md"]),
      ],
      async (root) => {
        const changesDir = join(root, CHANGES);

        const first = await scanArchivedChanges(changesDir);
        const second = await scanArchivedChanges(changesDir);

        assert.deepEqual(
          first.map((c) => c.name),
          [
            "2026-08-10-newer",
            "2026-01-05-older",
            "aaa-undated",
            "zzz-undated",
          ]
        );
        // Identical across runs over an unchanged archive.
        assert.deepEqual(
          first.map((c) => c.name),
          second.map((c) => c.name)
        );
      }
    );
  }
);

// =========================================================================
// Displayed only when asked for
// =========================================================================

testCovering(
  "with the archive hidden, no archived change reaches the page",
  "archive-browsing",
  ["Default invocation hides the archive"],
  async () => {
    await withTree(
      [
        ...open("add-dark-mode", ["proposal.md"]),
        ...archived("2026-08-10-old-work", ["proposal.md"]),
      ],
      async (root) => {
        const changesDir = join(root, CHANGES);
        const changes = await scanChanges(changesDir);

        // The server passes no archived changes at all while hidden; the page
        // is rendered the same way here.
        const html = renderIndex("proj", changes, changesDir, {
          view: VIEW_HIDDEN,
          archivedChanges: [],
        });

        assert.match(html, /add-dark-mode/);
        assert.ok(!html.includes("old-work"));
        // An archived change is never counted among the open ones.
        assert.match(html, /1 change found/);
      }
    );
  }
);

testCovering(
  "an empty open set does not fall back to the archived changes",
  "archive-browsing",
  ["An empty open set does not reveal the archive"],
  async () => {
    await withTree(
      archived("2026-08-10-old-work", ["proposal.md"]),
      async (root) => {
        const changesDir = join(root, CHANGES);
        const changes = await scanChanges(changesDir);

        assert.deepEqual(changes, [], "archive/ is not an open change");

        const html = renderIndex("proj", changes, changesDir, {
          view: VIEW_HIDDEN,
          archivedChanges: [],
        });

        assert.match(html, /No open changes found/);
        assert.ok(!html.includes("old-work"));
      }
    );
  }
);

testCovering(
  "asked for, every archived change is available to read",
  "archive-browsing",
  ["Requested archived changes are displayed"],
  async () => {
    await withTree(
      [
        ...archived("2026-08-10-one", ["proposal.md"]),
        ...archived("2026-01-05-two", ["proposal.md"]),
      ],
      async (root) => {
        const changesDir = join(root, CHANGES);
        const archivedChanges = await scanArchivedChanges(changesDir);

        const html = renderIndex("proj", [], changesDir, {
          view: VIEW_SHOWN,
          archivedChanges,
        });

        for (const change of archivedChanges) {
          assert.ok(
            html.includes(`/archived/${change.slug}`),
            `${change.name} is reachable`
          );
        }
      }
    );
  }
);

// =========================================================================
// Presented apart from the open changes
// =========================================================================

testCovering(
  "archived changes appear in their own labelled group, never among the open ones",
  "archive-browsing",
  ["Archived group is separate and labelled", "Open listing is unchanged"],
  async () => {
    await withTree(
      [
        ...open("add-dark-mode", ["proposal.md"]),
        ...open("remove-legacy", ["proposal.md"]),
        ...archived("2026-08-10-old-work", ["proposal.md"]),
      ],
      async (root) => {
        const changesDir = join(root, CHANGES);
        const changes = await scanChanges(changesDir);
        const archivedChanges = await scanArchivedChanges(changesDir);

        const shown = renderIndex("proj", changes, changesDir, {
          view: VIEW_SHOWN,
          archivedChanges,
        });
        const hidden = renderIndex("proj", changes, changesDir, {
          view: VIEW_HIDDEN,
          archivedChanges: [],
        });

        // Its own labelled heading, and the archived entry falls after it.
        assert.match(shown, /<h2 class="section-heading">Archived changes<\/h2>/);
        assert.ok(
          shown.indexOf("Archived changes") < shown.indexOf("old-work"),
          "the archived entry is inside the archived group"
        );
        assert.ok(
          shown.indexOf("old-work") > shown.indexOf("remove-legacy"),
          "no archived change is interleaved among the open ones"
        );

        // The open listing itself is byte-identical: same order, same content,
        // whether or not the archived group follows it. Sliced to the list
        // alone, since the header carries the toggle, which must differ.
        const openList = (html: string): string => {
          const start = html.indexOf('<ul class="change-list"');
          return html.slice(start, html.indexOf("</ul>", start));
        };
        assert.equal(openList(shown), openList(hidden));
      }
    );
  }
);

testCovering(
  "asking for archived changes when there are none says so",
  "archive-browsing",
  ["Empty archive is stated"],
  async () => {
    await withTree(open("add-dark-mode", ["proposal.md"]), async (root) => {
      const changesDir = join(root, CHANGES);
      const changes = await scanChanges(changesDir);

      const html = renderIndex("proj", changes, changesDir, {
        view: VIEW_SHOWN,
        archivedChanges: [],
      });

      assert.match(html, /There are no archived changes\./);
    });
  }
);

// =========================================================================
// Addressing
// =========================================================================

testCovering(
  "an archived change and an open change of the same name get separate addresses",
  "archive-browsing",
  ["Identical names do not collide", "Listed archived change is reachable"],
  async () => {
    await withTree(
      [
        ...open("add-dark-mode", ["proposal.md"]),
        ...archived("2026-08-10-add-dark-mode", ["design.md"]),
      ],
      async (root) => {
        const changesDir = join(root, CHANGES);
        const changes = await scanChanges(changesDir);
        const archivedChanges = await scanArchivedChanges(changesDir);

        assert.equal(archivedChanges[0].archived?.displayName, "add-dark-mode");

        const html = renderIndex("proj", changes, changesDir, {
          view: VIEW_SHOWN,
          archivedChanges,
        });

        // Two addresses under different prefixes, so neither resolves to the
        // other. The archived slug keeps the date, which is what keeps them
        // distinct even though the display names match.
        assert.ok(html.includes(`/change/${changes[0].slug}`));
        assert.ok(html.includes(`/archived/${archivedChanges[0].slug}`));
        assert.notEqual(changes[0].slug, archivedChanges[0].slug);
      }
    );
  }
);

// =========================================================================
// The marking on the page
// =========================================================================

testCovering(
  "a dated archived change is marked as archived and shows its date",
  "archive-browsing",
  ["Archived change carries the marking"],
  async () => {
    await withTree(
      archived("2026-08-10-old-work", ["proposal.md"]),
      async (root) => {
        const [change] = await scanArchivedChanges(join(root, CHANGES));

        const html = await renderChange("proj", change);

        assert.match(html, /<p class="archived-banner" role="note">/);
        assert.match(html, /Archived on 2026-08-10/);
        assert.match(html, /history, not pending work/);
      }
    );
  }
);

testCovering(
  "an undated archived change is still marked as archived",
  "archive-browsing",
  ["Undated archived change is still marked"],
  async () => {
    await withTree(archived("hand-moved", ["proposal.md"]), async (root) => {
      const [change] = await scanArchivedChanges(join(root, CHANGES));

      const html = await renderChange("proj", change);

      assert.match(html, /<p class="archived-banner" role="note">/);
      assert.match(html, /history, not pending work/);
      assert.ok(!/Archived on/.test(html));
    });
  }
);

testCovering(
  "an open change carries no archived marking",
  "archive-browsing",
  ["Open change is not marked"],
  async () => {
    await withTree(open("add-dark-mode", ["proposal.md"]), async (root) => {
      const [change] = await scanChanges(join(root, CHANGES));

      const html = await renderChange("proj", change);

      // The class name itself is in every page's stylesheet; what an open
      // change must not carry is the element.
      assert.ok(!html.includes('<p class="archived-banner"'));
      assert.ok(!/history, not pending work/.test(html));
    });
  }
);

// =========================================================================
// The archive directory as a target
// =========================================================================

testCovering(
  "targeting the archive directory yields a listing, not one merged change",
  "archive-browsing",
  ["Archive directory yields a listing"],
  async () => {
    await withTree(
      [
        ...archived("2026-08-10-one", ["proposal.md", "tasks.md"]),
        ...archived("2026-01-05-two", ["proposal.md"]),
      ],
      async (root) => {
        const changesDir = join(root, CHANGES);
        const archivedChanges = await scanArchivedChanges(changesDir);

        const html = renderIndex("proj", [], changesDir, {
          view: VIEW_SHOWN,
          archivedChanges,
          archiveOnly: true,
        });

        assert.match(html, /<h1>Archived Changes<\/h1>/);
        assert.match(html, /2 changes found/);
        // Each one addressable on its own.
        for (const change of archivedChanges) {
          assert.ok(html.includes(`/archived/${change.slug}`));
        }
      }
    );
  }
);

test("the archive directory is never scanned as an open change", async () => {
  await withTree(
    [
      ...open("add-dark-mode", ["proposal.md"]),
      ...archived("2026-08-10-old", ["proposal.md"]),
    ],
    async (root) => {
      const changes: Change[] = await scanChanges(join(root, CHANGES));

      assert.deepEqual(
        changes.map((c) => c.name),
        ["add-dark-mode"]
      );
    }
  );
});
