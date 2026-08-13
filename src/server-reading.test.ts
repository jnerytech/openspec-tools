import assert from "node:assert/strict";
import { mkdirSync, renameSync, writeFileSync } from "fs";
import { resolve } from "path";
import { withServer } from "./gate/cli-runner.js";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * The routes, over a running reader. These are the archive scenarios that are
 * about *addresses* and about changing the view without restarting - neither
 * can be shown by rendering a page in isolation, because both are statements
 * about what the server does between requests.
 */

const CHANGES = "openspec/changes";
const ARCHIVE = `${CHANGES}/archive`;

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
  [`${CHANGES}/add-dark-mode/proposal.md`]: "# Open proposal\n\nOpen text.\n",
  [`${ARCHIVE}/2026-08-10-old-work/proposal.md`]:
    "# Archived proposal\n\nArchived text.\n",
};

// =========================================================================
// Revealing and hiding while running
// =========================================================================

testCovering(
  "archived changes are revealed and hidden without the process restarting",
  "archive-browsing",
  [
    "Revealing archived changes while running",
    "Hiding archived changes while running",
  ],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read"], { cwd: root }, async (reader) => {
        // Started with the archive hidden.
        const hidden = await reader.get("/");
        assert.equal(hidden.status, 200);
        assert.ok(!hidden.body.includes("old-work"));

        // Revealed, by the same process.
        const shown = await reader.get("/?archived=1");
        assert.equal(shown.status, 200);
        assert.match(shown.body, /old-work/);

        // And hidden again.
        const again = await reader.get("/?archived=0");
        assert.ok(!again.body.includes("old-work"));
        assert.match(again.body, /add-dark-mode/);
      });
    });
  }
);

testCovering(
  "the invocation decides what the first page load shows",
  "archive-browsing",
  ["Initial state follows the invocation"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read", "--archived"], { cwd: root }, async (reader) => {
        const first = await reader.get("/");

        assert.match(first.body, /Archived changes/);
        assert.match(first.body, /old-work/);
      });
    });
  }
);

testCovering(
  "work archived while the reader runs shows up on the next reload",
  "archive-browsing",
  ["Newly archived work appears on reload"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read", "--archived"], { cwd: root }, async (reader) => {
        assert.ok(!(await reader.get("/")).body.includes("just-finished"));

        // Archived the way `openspec archive` does it: the directory moves
        // under archive/ with a date prefix.
        mkdirSync(resolve(root, `${CHANGES}/just-finished`), { recursive: true });
        writeFileSync(
          resolve(root, `${CHANGES}/just-finished/proposal.md`),
          "# Just finished\n"
        );
        renameSync(
          resolve(root, `${CHANGES}/just-finished`),
          resolve(root, `${ARCHIVE}/2026-08-12-just-finished`)
        );

        const reloaded = await reader.get("/");

        assert.match(reloaded.body, /just-finished/);
      });
    });
  }
);

// =========================================================================
// Addressing
// =========================================================================

testCovering(
  "an archived change is reachable at its own address",
  "archive-browsing",
  ["Listed archived change is reachable"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read", "--archived"], { cwd: root }, async (reader) => {
        const index = await reader.get("/");
        const href = /href="(\/archived\/[^"]+)"/.exec(index.body)?.[1];
        assert.ok(href, "the listing carries an archived address");

        const page = await reader.get(href.replace(/&amp;/g, "&"));

        assert.equal(page.status, 200);
        assert.match(page.body, /Archived text\./);
        assert.match(page.body, /<p class="archived-banner" role="note">/);
      });
    });
  }
);

testCovering(
  "an archived address that names nothing is reported as not found",
  "archive-browsing",
  ["Unknown archived address is reported"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read", "--archived"], { cwd: root }, async (reader) => {
        const missing = await reader.get("/archived/no-such-thing");

        assert.equal(missing.status, 404);
        // Not another change served in its place.
        assert.ok(!missing.body.includes("Archived text."));
        assert.ok(!missing.body.includes("Open text."));
      });
    });
  }
);

testCovering(
  "same-named open and archived changes each yield their own artifacts",
  "archive-browsing",
  ["Identical names do not collide"],
  async () => {
    await withFiles(
      {
        "openspec/config.yaml": "schema: spec-driven\n",
        [`${CHANGES}/add-dark-mode/proposal.md`]: "# Open one\n\nThe open text.\n",
        [`${ARCHIVE}/2026-08-10-add-dark-mode/proposal.md`]:
          "# Archived one\n\nThe archived text.\n",
      },
      async (root) => {
        await withServer(["read", "--archived"], { cwd: root }, async (reader) => {
          const openPage = await reader.get("/change/add-dark-mode");
          const archivedPage = await reader.get(
            "/archived/2026-08-10-add-dark-mode"
          );

          assert.equal(openPage.status, 200);
          assert.match(openPage.body, /The open text\./);
          assert.ok(!openPage.body.includes("The archived text."));

          assert.equal(archivedPage.status, 200);
          assert.match(archivedPage.body, /The archived text\./);
          assert.ok(!archivedPage.body.includes("The open text."));
        });
      }
    );
  }
);

// =========================================================================
// cli-interface: the invocations that serve
// =========================================================================

testCovering(
  "reading with no target is reached through the read subcommand and serves",
  "cli-interface",
  ["Reading is reached through the read subcommand", "Omitting the option is a complete invocation"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read"], { cwd: root }, async (reader) => {
        const index = await reader.get("/");

        assert.equal(index.status, 200);
        assert.match(index.body, /Open Changes/);
        assert.match(index.body, /add-dark-mode/);
      });
    });
  }
);

testCovering(
  "the archived option is recognized as an option, not taken as a target",
  "cli-interface",
  ["Option is recognized, not treated as a target", "Archived changes are excluded by default"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await withServer(["read", "--archived"], { cwd: root }, async (reader) => {
        // Not resolved as a target named "--archived", and not an error.
        assert.ok(!reader.announcement.includes("not found"));
        assert.match(reader.announcement, /reading: openspec\/changes\//);
        assert.match((await reader.get("/")).body, /old-work/);
      });

      // And without it, the archive stays out.
      await withServer(["read"], { cwd: root }, async (reader) => {
        assert.ok(!(await reader.get("/")).body.includes("old-work"));
      });
    });
  }
);

testCovering(
  "a change named like a subcommand is reachable by its bare name",
  "cli-interface",
  [
    "A change named help is reachable by name",
    "A change whose name collides with a subcommand is reachable by name",
  ],
  async () => {
    await withFiles(
      {
        "openspec/config.yaml": "schema: spec-driven\n",
        [`${CHANGES}/help/proposal.md`]: "# A change called help\n\nIts text.\n",
        [`${CHANGES}/skill/proposal.md`]: "# A change called skill\n\nOther text.\n",
      },
      async (root) => {
        await withServer(["read", "help"], { cwd: root }, async (reader) => {
          // Served as a change, and usage was not printed in its place.
          assert.match(reader.announcement, /reading: change help/);
          assert.ok(!reader.announcement.includes("Usage: opsx-tools"));
          assert.match((await reader.get("/")).body, /Its text\./);
        });

        await withServer(["read", "skill"], { cwd: root }, async (reader) => {
          assert.match(reader.announcement, /reading: change skill/);
          assert.match((await reader.get("/")).body, /Other text\./);
        });
      }
    );
  }
);

testCovering(
  "an archived change is a target by directory name and by display name",
  "cli-interface",
  ["Archived change resolved by directory name", "Archived change resolved by display name"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      // The archived directory name, date prefix and all.
      await withServer(
        ["read", "2026-08-10-old-work"],
        { cwd: root },
        async (reader) => {
          assert.match(reader.announcement, /reading: change old-work \(archived\)/);
          assert.match((await reader.get("/")).body, /Archived text\./);
        }
      );

      // And the display name, without it - the option that includes archived
      // changes is not additionally required.
      await withServer(["read", "old-work"], { cwd: root }, async (reader) => {
        assert.match(reader.announcement, /reading: change old-work \(archived\)/);
        assert.match((await reader.get("/")).body, /Archived text\./);
      });
    });
  }
);

testCovering(
  "an open change wins a name conflict, and the archived twin is named",
  "cli-interface",
  ["Open change wins a name conflict"],
  async () => {
    await withFiles(
      {
        "openspec/config.yaml": "schema: spec-driven\n",
        [`${CHANGES}/add-dark-mode/proposal.md`]: "# Open one\n\nThe open text.\n",
        [`${ARCHIVE}/2026-08-10-add-dark-mode/proposal.md`]:
          "# Archived one\n\nThe archived text.\n",
      },
      async (root) => {
        await withServer(
          ["read", "add-dark-mode"],
          { cwd: root },
          async (reader) => {
            assert.match((await reader.get("/")).body, /The open text\./);

            assert.match(
              reader.announcement,
              /An archived change of the same name also exists: 2026-08-10-add-dark-mode/
            );
            // The command it names is complete and runnable.
            assert.match(
              reader.announcement,
              /Read it with: opsx-tools read 2026-08-10-add-dark-mode/
            );
          }
        );
      }
    );
  }
);

testCovering(
  "an empty changes directory is reported and still served",
  "cli-interface",
  ["Empty changes directory still serves"],
  async () => {
    await withFiles(
      { "openspec/config.yaml": "schema: spec-driven\n", [`${CHANGES}/.keep`]: "" },
      async (root) => {
        await withServer(["read"], { cwd: root }, async (reader) => {
          assert.match(reader.announcement, /No open changes in/);
          assert.match(reader.announcement, /openspec\/changes/);
          // Serving anyway: the user can create a change and reload.
          assert.equal((await reader.get("/")).status, 200);
        });
      }
    );
  }
);

testCovering(
  "a directory holding only an archive counts as empty, and names the option",
  "cli-interface",
  ["Archive-only directory counts as empty"],
  async () => {
    await withFiles(
      {
        "openspec/config.yaml": "schema: spec-driven\n",
        [`${ARCHIVE}/2026-08-10-old-work/proposal.md`]: "# Archived\n\ntext\n",
      },
      async (root) => {
        await withServer(["read"], { cwd: root }, async (reader) => {
          assert.match(reader.announcement, /No open changes in/);
          assert.match(reader.announcement, /only archive\/ was found/);
          // The option is named as a complete, runnable invocation.
          assert.match(
            reader.announcement,
            /Run 'opsx-tools read --archived' to read the archived changes\./
          );
          // Naming it does not display them.
          assert.ok(!(await reader.get("/")).body.includes("old-work"));
        });
      }
    );
  }
);

testCovering(
  "a missing changes directory is reported, and the reader still starts",
  "cli-interface",
  ["Missing changes directory is reported"],
  async () => {
    await withFiles(
      { "openspec/config.yaml": "schema: spec-driven\n" },
      async (root) => {
        await withServer(["read"], { cwd: root }, async (reader) => {
          assert.match(reader.announcement, /openspec\/changes\/ not found/);
          assert.match(
            reader.announcement,
            /Run 'opsx-tools read --help' for usage\./
          );
          assert.equal((await reader.get("/")).status, 200);
        });
      }
    );
  }
);

testCovering(
  "targeting the archive directory lists the archived changes",
  "archive-browsing",
  ["Archive directory yields a listing"],
  async () => {
    await withFiles(
      {
        "openspec/config.yaml": "schema: spec-driven\n",
        [`${ARCHIVE}/2026-08-10-one/proposal.md`]: "# One\n\nFirst text.\n",
        [`${ARCHIVE}/2026-01-05-two/proposal.md`]: "# Two\n\nSecond text.\n",
      },
      async (root) => {
        await withServer(
          ["read", "openspec/changes/archive"],
          { cwd: root },
          async (reader) => {
            const index = await reader.get("/");

            assert.match(index.body, /<h1>Archived Changes<\/h1>/);
            assert.match(index.body, /2 changes found/);
            // Not one merged change holding every archived file.
            assert.ok(!index.body.includes("First text."));
            assert.ok(!index.body.includes("Second text."));

            const first = await reader.get("/archived/2026-08-10-one");
            assert.equal(first.status, 200);
            assert.match(first.body, /First text\./);
            assert.ok(!first.body.includes("Second text."));
          }
        );
      }
    );
  }
);
