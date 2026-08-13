import assert from "node:assert/strict";
import { join } from "path";
import { scanChanges, scanArchivedChanges } from "./scanner.js";
import { withTree, names, testCovering } from "./test-fixture.js";

/** Lays the given files out inside a change, under a changes directory. */
function change(name: string, artifacts: string[]): string[] {
  return artifacts.map((rel) => join(name, rel));
}

testCovering(
  "a change carrying every artifact is presented in the reading order",
  "artifact-ordering",
  [
    "A change carrying every artifact",
    "The contract precedes the work",
    "Orientation leads",
  ],
  async () => {
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
  }
);

testCovering(
  "absent artifacts leave no gap",
  "artifact-ordering",
  ["Absent artifacts leave no gap"],
  async () => {
    await withTree(
      change("partial", [
        "proposal.md",
        "tasks.md",
        "specs/artifact-ordering/spec.md",
      ]),
      async (changesDir) => {
        const [scanned] = await scanChanges(changesDir);

        assert.deepEqual(names(scanned.artifacts), [
          "proposal",
          "spec",
          "tasks",
        ]);
      }
    );
  }
);

testCovering(
  "an artifact the order does not name is presented last, separating none",
  "artifact-ordering",
  [
    "An unrecognised artifact is presented last",
    "Named artifacts are not separated",
  ],
  async () => {
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
  }
);

testCovering(
  "several spec files keep one stable sequence across repeated scans",
  "artifact-ordering",
  ["Repeated reads agree"],
  async () => {
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
  }
);

testCovering(
  "two changes laid out alike present their spec files in the same sequence",
  "artifact-ordering",
  ["Directory read order does not decide the sequence"],
  async () => {
    // The same four capabilities in each change, created in opposite orders.
    // Whichever order `readdir` reports them in, the tie-break has to decide.
    const capabilities = [
      "server-startup",
      "artifact-ordering",
      "cli-interface",
      "archive-browsing",
    ];
    const specs = (order: string[]): string[] =>
      order.map((cap) => `specs/${cap}/spec.md`);

    await withTree(
      [
        ...change("one", ["proposal.md", ...specs(capabilities)]),
        ...change("two", ["proposal.md", ...specs([...capabilities].reverse())]),
      ],
      async (changesDir) => {
        const [one, two] = (await scanChanges(changesDir)).sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        // Compared by the path within each change, which is what the slug is:
        // the two changes hold the same capabilities, so the same sequence.
        const within = (c: (typeof one)["artifacts"][number]): string =>
          c.slug.replace(/^specs-/, "");
        assert.deepEqual(one.artifacts.map(within), two.artifacts.map(within));
        assert.deepEqual(names(one.artifacts), names(two.artifacts));
      }
    );
  }
);

testCovering(
  "several uncovered files keep one sequence across repeated scans",
  "artifact-ordering",
  ["Uncovered artifacts are stable among themselves"],
  async () => {
    await withTree(
      change("many-notes", [
        "proposal.md",
        "notes.md",
        "background.md",
        "meeting.md",
      ]),
      async (changesDir) => {
        const first = (await scanChanges(changesDir))[0].artifacts;
        const second = (await scanChanges(changesDir))[0].artifacts;

        // Three files the named order does not cover, in a sequence that does
        // not vary between runs over the unchanged change.
        assert.deepEqual(names(first), names(second));
        assert.deepEqual(
          first.map((a) => a.slug),
          second.map((a) => a.slug)
        );
        assert.equal(names(first)[0], "proposal");
        assert.deepEqual(names(first).slice(1).sort(), [
          "background",
          "meeting",
          "notes",
        ]);
      }
    );
  }
);

testCovering(
  "an archived change is ordered like an open one holding the same artifacts",
  "artifact-ordering",
  ["An archived change is ordered identically"],
  async () => {
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
  }
);
