import assert from "node:assert/strict";
import { resolve } from "path";
import { resolveMode } from "./cli.js";
import { isExitError, type ExitError } from "./exit.js";
import { buildProgram } from "./program.js";
import { testCovering, withFiles } from "./test-fixture.js";
import type { TargetMode } from "./types.js";

/**
 * The `read` command as it exists inside the program, not on its own: the help
 * a refusal points at is derived by walking to the root, so a command with no
 * parent would name itself "read" rather than "opsx-tools read".
 */
function readCommandInProgram(): ReturnType<typeof buildProgram> {
  const program = buildProgram();
  const read = program.commands.find((cmd) => cmd.name() === "read");
  assert.ok(read, "the program has a read subcommand");
  return read;
}

/**
 * What a `read` invocation decides before anything is bound: which target the
 * positional word names, and what it says when it names nothing.
 *
 * Driven directly rather than through the command, so no server is started —
 * the resolution is the whole of what is under test, and binding a port would
 * only add a thing to clean up.
 */

const CHANGES = "openspec/changes";
const ARCHIVE = `${CHANGES}/archive`;

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
  [`${CHANGES}/add-dark-mode/proposal.md`]: "# p\n",
  [`${ARCHIVE}/2026-08-10-old-work/proposal.md`]: "# p\n",
  "docs/notes.md": "# Notes\n",
  "single.md": "# Single\n",
};

/** Resolves a target from `root`, capturing what was warned along the way. */
async function resolving<T>(
  root: string,
  fn: (
    resolveTarget: (target?: string) => Promise<TargetMode>,
    warned: string[]
  ) => Promise<T>
): Promise<T> {
  const previousCwd = process.cwd();
  const warned: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => void warned.push(args.join(" "));
  process.chdir(root);

  try {
    return await fn(
      (target?: string) => resolveMode(readCommandInProgram(), target),
      warned
    );
  } finally {
    process.chdir(previousCwd);
    console.warn = originalWarn;
  }
}

/** The refusal a resolution threw, as text. */
async function refusalOf(call: Promise<unknown>): Promise<string> {
  try {
    await call;
    assert.fail("the resolution was expected to refuse");
  } catch (err) {
    assert.ok(isExitError(err), String(err));
    const exit = err as ExitError;
    return [exit.message, ...exit.details].join("\n");
  }
}

// =========================================================================
// No target
// =========================================================================

testCovering(
  "with no target and no changes directory, the absence is reported and it still serves",
  "cli-interface",
  ["Missing changes directory is reported"],
  async () => {
    await withFiles(
      { "openspec/config.yaml": "schema: spec-driven\n" },
      async (root) => {
        await resolving(root, async (resolveTarget, warned) => {
          const mode = await resolveTarget(undefined);

          assert.deepEqual(mode, {
            kind: "changes",
            changesDir: resolve(root, CHANGES),
          });
          assert.match(warned.join("\n"), /openspec\/changes\/ not found/);
          assert.match(warned.join("\n"), /Serving an empty list anyway/);
          assert.match(warned.join("\n"), /read --help/);
        });
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
        await resolving(root, async (resolveTarget, warned) => {
          const mode = await resolveTarget(undefined);

          assert.equal(mode.kind, "changes");
          assert.match(warned.join("\n"), /No open changes in/);
          // No archive to point at, so the option is not named.
          assert.ok(!warned.join("\n").includes("--archived"));
        });
      }
    );
  }
);

testCovering(
  "a directory holding only an archive counts as empty and names the option",
  "cli-interface",
  ["Archive-only directory counts as empty"],
  async () => {
    await withFiles(
      {
        "openspec/config.yaml": "schema: spec-driven\n",
        [`${ARCHIVE}/2026-08-10-old-work/proposal.md`]: "# p\n",
      },
      async (root) => {
        await resolving(root, async (resolveTarget, warned) => {
          const mode = await resolveTarget(undefined);

          assert.equal(mode.kind, "changes");
          const text = warned.join("\n");
          assert.match(text, /only archive\/ was found/);
          assert.match(text, /Run 'opsx-tools read --archived'/);
        });
      }
    );
  }
);

testCovering(
  "with open changes present, nothing is warned",
  "cli-interface",
  ["Omitting the option is a complete invocation"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await resolving(root, async (resolveTarget, warned) => {
        const mode = await resolveTarget(undefined);

        assert.equal(mode.kind, "changes");
        assert.deepEqual(warned, []);
      });
    });
  }
);

// =========================================================================
// A target that resolves
// =========================================================================

testCovering(
  "an open change name resolves to that change",
  "cli-interface",
  ["A change named help is reachable by name"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await resolving(root, async (resolveTarget) => {
        const mode = await resolveTarget("add-dark-mode");

        assert.deepEqual(mode, {
          kind: "change",
          changeName: "add-dark-mode",
          dirPath: resolve(root, CHANGES, "add-dark-mode"),
        });
      });
    });
  }
);

testCovering(
  "an archived change resolves by directory name and by display name",
  "cli-interface",
  ["Archived change resolved by directory name", "Archived change resolved by display name"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await resolving(root, async (resolveTarget) => {
        const byDir = await resolveTarget("2026-08-10-old-work");
        assert.equal(byDir.kind, "change");
        assert.deepEqual(
          byDir.kind === "change" ? byDir.archived : undefined,
          { date: "2026-08-10", displayName: "old-work" }
        );

        const byDisplay = await resolveTarget("old-work");
        assert.equal(byDisplay.kind, "change");
        assert.deepEqual(
          byDisplay.kind === "change" ? byDisplay.dirPath : "",
          resolve(root, ARCHIVE, "2026-08-10-old-work")
        );
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
        [`${CHANGES}/add-dark-mode/proposal.md`]: "# open\n",
        [`${ARCHIVE}/2026-08-10-add-dark-mode/proposal.md`]: "# archived\n",
      },
      async (root) => {
        await resolving(root, async (resolveTarget, warned) => {
          const mode = await resolveTarget("add-dark-mode");

          assert.equal(mode.kind, "change");
          assert.deepEqual(
            mode.kind === "change" ? mode.dirPath : "",
            resolve(root, CHANGES, "add-dark-mode")
          );
          const text = warned.join("\n");
          assert.match(text, /An archived change of the same name also exists/);
          assert.match(
            text,
            /Read it with: opsx-tools read 2026-08-10-add-dark-mode/
          );
        });
      }
    );
  }
);

testCovering(
  "the archive directory itself resolves to a listing, by name and by path",
  "archive-browsing",
  ["Archive directory yields a listing"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await resolving(root, async (resolveTarget) => {
        for (const target of ["openspec/changes/archive", "./openspec/changes/archive"]) {
          const mode = await resolveTarget(target);
          assert.equal(mode.kind, "archive", target);
        }
      });
    });
  }
);

testCovering(
  "a folder, a file and the changes directory each resolve to their own shape",
  "cli-interface",
  ["A change whose name collides with a subcommand is reachable by name"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await resolving(root, async (resolveTarget) => {
        assert.deepEqual(await resolveTarget("./docs"), {
          kind: "dir",
          dirPath: resolve(root, "docs"),
        });
        assert.deepEqual(await resolveTarget("./single.md"), {
          kind: "file",
          filePath: resolve(root, "single.md"),
        });
        assert.deepEqual(await resolveTarget("./openspec/changes"), {
          kind: "changes",
          changesDir: resolve(root, CHANGES),
        });
        // A change addressed by its path, rather than by its bare name.
        const byPath = await resolveTarget("./openspec/changes/add-dark-mode");
        assert.equal(byPath.kind, "change");
      });
    });
  }
);

testCovering(
  "an archived change addressed by its path keeps its archived identity",
  "archive-browsing",
  ["Dated directory yields date and name"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await resolving(root, async (resolveTarget) => {
        const mode = await resolveTarget(
          "./openspec/changes/archive/2026-08-10-old-work"
        );

        assert.equal(mode.kind, "change");
        assert.deepEqual(
          mode.kind === "change" ? mode.archived : undefined,
          { date: "2026-08-10", displayName: "old-work" }
        );
      });
    });
  }
);

// =========================================================================
// A target that does not resolve
// =========================================================================

testCovering(
  "a target that exists but is not Markdown is refused",
  "cli-interface",
  ["An unresolvable positional word is a target error"],
  async () => {
    await withFiles({ ...PROJECT, "notes.txt": "plain\n" }, async (root) => {
      await resolving(root, async (resolveTarget) => {
        const text = await refusalOf(resolveTarget("./notes.txt"));

        assert.match(text, /Not a Markdown file/);
        assert.match(text, /Only \.md files can be served directly/);
      });
    });
  }
);

testCovering(
  "an unresolvable name lists every location tried",
  "cli-interface",
  ["Unresolvable target lists both attempts"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await resolving(root, async (resolveTarget) => {
        const text = await refusalOf(resolveTarget("teste"));

        assert.match(text, /Target 'teste' not found/);
        assert.match(text, /\.\/teste/);
        assert.match(text, /openspec\/changes\/teste/);
        assert.match(text, /openspec\/changes\/archive\/teste/);
      });
    });
  }
);

testCovering(
  "the archive named as a bare word is the archive itself, not a change in it",
  "archive-browsing",
  ["Archive directory yields a listing"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      await resolving(root, async (resolveTarget) => {
        // `archive` resolves under the changes directory, and there it names
        // the archive rather than a change called "archive".
        const mode = await resolveTarget("archive");

        assert.deepEqual(mode, {
          kind: "archive",
          changesDir: resolve(root, CHANGES),
        });
      });
    });
  }
);

testCovering(
  "a target that is neither a file nor a directory is refused",
  "cli-interface",
  ["An unresolvable positional word is a target error"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      // A named pipe exists, and is neither of the two shapes the reader
      // serves. Refusing names it rather than trying to read it.
      const { execFileSync } = await import("child_process");
      execFileSync("mkfifo", [resolve(root, "a-pipe")]);

      await resolving(root, async (resolveTarget) => {
        const text = await refusalOf(resolveTarget("./a-pipe"));

        assert.match(text, /Unsupported target type/);
        assert.match(text, /a-pipe/);
      });
    });
  }
);
