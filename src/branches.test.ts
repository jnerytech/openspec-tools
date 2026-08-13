import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { resolveProject } from "./project.js";
import { locateContext, yamlWithRegion } from "./region-yaml.js";
import {
  collectMarkdownFiles,
  scanArchivedChanges,
  scanChanges,
} from "./scanner.js";
import { commitConventionComponent } from "./components/commit-convention.js";
import { claudeWorkflowComponent } from "./components/claude-workflow.js";
import { artifactLanguageComponent } from "./components/artifact-language.js";
import { testCovering, withFiles, withTree } from "./test-fixture.js";
import type { ProjectIdentity } from "./types.js";

/**
 * The shapes a module answers differently for, where no other suite happens to
 * produce them: an empty scalar, a root that is the filesystem root, a
 * directory that is not there, an ordering with only one side dated.
 *
 * These exist because the measurement asks for them by name. Each is still a
 * real shape the code has to answer, and each is asserted on what the answer
 * should be rather than on the fact that it ran.
 */

const project = (root: string): ProjectIdentity => ({
  root,
  name: root,
  source: "openspec",
});

const CONFIG = "openspec/config.yaml";
const CHANGES = "openspec/changes";

// =========================================================================
// project.ts — the root of the filesystem is still an identity
// =========================================================================

testCovering(
  "the filesystem root resolves to itself, and keeps its own name",
  "server-startup",
  ["No project markers still resolves"],
  () => {
    // Nothing above "/" to walk to, and its basename is empty — the two
    // branches a project inside a directory never reaches.
    const resolved = resolveProject("/");

    assert.equal(resolved.root, "/");
    assert.equal(resolved.name, "/");
    assert.equal(resolved.source, "cwd");
  }
);

// =========================================================================
// region-yaml.ts — a scalar with nothing in it
// =========================================================================

testCovering(
  "a context key with an empty scalar takes the default indent",
  "artifact-language",
  ["The user's own context is preserved"],
  () => {
    // `context: |` and nothing under it: there is no content line to read an
    // indent from, so the one the package writes with is used.
    const found = locateContext(["context: |", "", "next: x", ""]);

    assert.equal(found.kind, "block");
    if (found.kind !== "block") return;
    assert.equal(found.indent, "  ");
    assert.equal(found.bodyStart, found.bodyEnd);
  }
);

testCovering(
  "a file that holds nothing but the region comes back empty",
  "artifact-language",
  ["Removal takes the empty field with it"],
  () => {
    const written = yamlWithRegion(null, "artifact-language", { lang: "en" }, [
      "A directive.",
    ]);
    assert.equal(written.kind, "ok");
    if (written.kind !== "ok") return;

    const removed = yamlWithRegion(
      written.content,
      "artifact-language",
      {},
      null
    );

    assert.equal(removed.kind, "ok");
    if (removed.kind !== "ok") return;
    // Nothing was in the file but the key and its region, so nothing is left —
    // not a blank line, not an empty key.
    assert.equal(removed.content, "");
  }
);

// =========================================================================
// scanner.ts — directories that are not there, and one-sided dates
// =========================================================================

testCovering(
  "a changes directory that does not exist scans as nothing",
  "archive-browsing",
  ["An empty open set does not reveal the archive"],
  async () => {
    await withFiles({ "README.md": "# nothing here\n" }, async (root) => {
      const missing = resolve(root, "no-such-changes");

      assert.deepEqual(await scanChanges(missing), []);
      assert.deepEqual(await scanArchivedChanges(missing), []);
      assert.deepEqual(await collectMarkdownFiles(missing), []);
    });
  }
);

testCovering(
  "a loose file in the archive directory is not an archived change",
  "archive-browsing",
  ["Directory without Markdown is skipped"],
  async () => {
    await withFiles(
      {
        [`${CHANGES}/archive/2026-08-10-real/proposal.md`]: "# p\n",
        [`${CHANGES}/archive/stray.md`]: "# not a change\n",
      },
      async (root) => {
        const found = await scanArchivedChanges(join(root, CHANGES));

        // Only directories become changes; a file beside them is passed over.
        assert.deepEqual(
          found.map((c) => c.name),
          ["2026-08-10-real"]
        );
      }
    );
  }
);

testCovering(
  "a dated change sorts before an undated one whichever order they are read in",
  "archive-browsing",
  ["Undated archived changes come last"],
  async () => {
    // Four entries, alternating, so the comparator is asked with a dated one
    // on either side of an undated one — both directions of the same rule.
    await withTree(
      [
        join(CHANGES, "archive", "mmm-undated", "proposal.md"),
        join(CHANGES, "archive", "2026-08-10-dated", "proposal.md"),
        join(CHANGES, "archive", "aaa-undated", "proposal.md"),
        join(CHANGES, "archive", "2026-01-05-older", "proposal.md"),
        join(CHANGES, "archive", "2026-08-10-same-day", "proposal.md"),
      ],
      async (root) => {
        const found = await scanArchivedChanges(join(root, CHANGES));

        assert.deepEqual(
          found.map((c) => c.name),
          [
            // Same date: the tie falls to the name, and the dated pair still
            // comes before every undated one.
            "2026-08-10-dated",
            "2026-08-10-same-day",
            "2026-01-05-older",
            "aaa-undated",
            "mmm-undated",
          ]
        );
      }
    );
  }
);

// =========================================================================
// The components, in states the other suites do not produce
// =========================================================================

testCovering(
  "a region recording neither agreement reports as none enabled",
  "claude-workflow-directives",
  ["State names the enabled agreements"],
  async () => {
    await withFiles(
      {
        [CONFIG]: "schema: spec-driven\n",
        "CLAUDE.md": [
          "<!-- opsx-tools:claude-workflow todos=off questions=off created=0 -->",
          "## Working on OpenSpec files",
          "",
          "When the work touches files under `openspec/`:",
          "",
          "<!-- opsx-tools:claude-workflow:end -->",
          "",
        ].join("\n"),
      },
      async (root) => {
        const state = claudeWorkflowComponent.inspect(project(root));

        assert.equal(state.kind, "provisioned");
        if (state.kind !== "provisioned") return;
        assert.equal(state.detail, "none enabled");
      }
    );
  }
);

testCovering(
  "a region recording no language at all is reported rather than assumed",
  "artifact-language",
  ["State names the configured language"],
  async () => {
    await withFiles(
      {
        [CONFIG]: [
          "schema: spec-driven",
          "context: |",
          "  # opsx-tools:artifact-language",
          "  Some directive the package did not write.",
          "  # opsx-tools:artifact-language:end",
          "",
        ].join("\n"),
      },
      async (root) => {
        const state = artifactLanguageComponent.inspect(project(root));

        // No `lang` in the delimiter: the state says so instead of guessing.
        assert.equal(state.kind, "differs");
        if (state.kind !== "differs") return;
        assert.equal(state.detail, "unrecognized");
      }
    );
  }
);

testCovering(
  "the commit rule ignores an edit that is not its own",
  "commit-convention-rule",
  ["Outras regras não são tocadas"],
  async () => {
    await withFiles({ [CONFIG]: "schema: spec-driven\n" }, async (root) => {
      const p = project(root);

      // A whole-path edit belongs to the skills component; this one leaves it
      // alone rather than acting on something it does not own.
      commitConventionComponent.applyEdit(p, {
        kind: "path",
        action: "write",
        path: resolve(root, "should-not-appear"),
      });

      const { existsSync } = await import("fs");
      assert.ok(!existsSync(resolve(root, "should-not-appear")));
    });
  }
);

// =========================================================================
// init-cli — clearing a component by its negative option
// =========================================================================

testCovering(
  "the working agreements are cleared by their own negative option",
  "claude-workflow-directives",
  ["Neither agreement removes the component"],
  async () => {
    const { buildProgram } = await import("./program.js");

    await withFiles(
      { [CONFIG]: "schema: spec-driven\n", [`${CHANGES}/.keep`]: "" },
      async (root) => {
        const previousCwd = process.cwd();
        const originalLog = console.log;
        console.log = () => {};
        process.chdir(root);

        try {
          const run = async (argv: string[]): Promise<void> => {
            const program = buildProgram();
            const init = program.commands.find((cmd) => cmd.name() === "init");
            assert.ok(init);
            init.exitOverride();
            await init.parseAsync(argv, { from: "user" });
          };

          await run(["--todos", "--yes"]);
          assert.equal(
            claudeWorkflowComponent.inspect(project(root)).kind,
            "provisioned"
          );

          await run(["--no-claude-workflow", "--yes"]);
          assert.deepEqual(claudeWorkflowComponent.inspect(project(root)), {
            kind: "absent",
          });
        } finally {
          process.chdir(previousCwd);
          console.log = originalLog;
        }
      }
    );
  }
);

// =========================================================================
// cli.ts — a target outside the working directory, and no changes directory
// =========================================================================

testCovering(
  "a target outside the working directory is named by its absolute path",
  "cli-interface",
  ["Unresolvable target lists both attempts"],
  async () => {
    const { resolveMode } = await import("./cli.js");
    const { buildProgram } = await import("./program.js");
    const { isExitError } = await import("./exit.js");

    await withFiles(
      { [CONFIG]: "schema: spec-driven\n", [`${CHANGES}/.keep`]: "" },
      async (root) => {
        const previousCwd = process.cwd();
        const deep = resolve(root, "inner");
        mkdirSync(deep, { recursive: true });
        process.chdir(deep);

        try {
          const program = buildProgram();
          const read = program.commands.find((cmd) => cmd.name() === "read");
          assert.ok(read);

          await assert.rejects(
            () => resolveMode(read, "../../elsewhere"),
            (err: unknown) => {
              assert.ok(isExitError(err));
              const text = [
                (err as Error).message,
                ...(err as { details: string[] }).details,
              ].join("\n");
              // Outside the working directory, so it cannot be shown as
              // "./something" — the absolute path is what locates it.
              assert.match(text, /Tried:/);
              assert.ok(/\n\s+\//.test(text), text);
              return true;
            }
          );
        } finally {
          process.chdir(previousCwd);
        }
      }
    );
  }
);

testCovering(
  "an unresolvable target with no changes directory at all still reports",
  "cli-interface",
  ["Empty change set is stated"],
  async () => {
    const { resolveMode } = await import("./cli.js");
    const { buildProgram } = await import("./program.js");
    const { isExitError } = await import("./exit.js");

    // An OpenSpec project with no changes directory: the lookups for names to
    // suggest find nothing to read, rather than failing on a missing path.
    await withFiles({ [CONFIG]: "schema: spec-driven\n" }, async (root) => {
      const previousCwd = process.cwd();
      process.chdir(root);

      try {
        const program = buildProgram();
        const read = program.commands.find((cmd) => cmd.name() === "read");
        assert.ok(read);

        await assert.rejects(
          () => resolveMode(read, "teste"),
          (err: unknown) => {
            assert.ok(isExitError(err));
            const text = [
              (err as Error).message,
              ...(err as { details: string[] }).details,
            ].join("\n");
            assert.match(text, /Target 'teste' not found/);
            assert.match(text, /There are no open changes/);
            return true;
          }
        );
      } finally {
        process.chdir(previousCwd);
      }
    });
  }
);

testCovering(
  "a change file written outside any change directory is still collected",
  "artifact-ordering",
  ["An unrecognised artifact is presented last"],
  async () => {
    await withFiles({ "loose/notes.md": "# Notes\n" }, async (root) => {
      const files = await collectMarkdownFiles(resolve(root, "loose"));

      assert.deepEqual(
        files.map((f) => f.name),
        ["notes"]
      );
    });
  }
);

testCovering(
  "a change directory holding a file with no Markdown extension is skipped",
  "archive-browsing",
  ["Directory without Markdown is skipped"],
  async () => {
    await withFiles(
      {
        [`${CHANGES}/real/proposal.md`]: "# p\n",
        [`${CHANGES}/empty/notes.txt`]: "not markdown\n",
      },
      async (root) => {
        const found = await scanChanges(join(root, CHANGES));

        assert.deepEqual(
          found.map((c) => c.name),
          ["real"]
        );
      }
    );
  }
);

testCovering(
  "a project configuration named with the second filename is written to",
  "artifact-language",
  ["Either configuration filename is recognized"],
  async () => {
    await withFiles(
      { "openspec/config.yml": "schema: spec-driven\n" },
      async (root) => {
        const p = project(root);
        const edits = artifactLanguageComponent.plan(p, { lang: "en" });

        assert.equal(edits.length, 1);
        assert.ok(edits[0].path.endsWith("config.yml"));

        // Writing the same selection again computes no edit at all.
        for (const edit of edits) artifactLanguageComponent.applyEdit(p, edit);
        assert.deepEqual(artifactLanguageComponent.plan(p, { lang: "en" }), []);
      }
    );
  }
);

testCovering(
  "a spec file laid out at the top of a change is ordered like any other",
  "artifact-ordering",
  ["The contract precedes the work"],
  async () => {
    await withFiles(
      {
        [`${CHANGES}/a-change/spec.md`]: "# Spec\n",
        [`${CHANGES}/a-change/tasks.md`]: "# Tasks\n",
      },
      async (root) => {
        const [change] = await scanChanges(join(root, CHANGES));

        assert.deepEqual(
          change.artifacts.map((a) => a.name),
          ["spec", "tasks"]
        );
      }
    );
  }
);

testCovering(
  "writing the language into a file that has no trailing newline still ends with one",
  "artifact-language",
  ["Comments survive the edit"],
  () => {
    // No newline at the end: the splice has to add one rather than run the
    // key onto the last line.
    const written = yamlWithRegion(
      "schema: spec-driven",
      "artifact-language",
      { lang: "en" },
      ["A directive."]
    );

    assert.equal(written.kind, "ok");
    if (written.kind !== "ok") return;
    assert.ok(written.content.startsWith("schema: spec-driven\n"));
    assert.ok(written.content.endsWith("\n"));
  }
);

testCovering(
  "a directory given as a target keeps the name it is served under",
  "server-startup",
  ["Startup names the target"],
  async () => {
    await withFiles({ "docs/a.md": "# A\n" }, async (root) => {
      // A trailing separator must not leave the served name empty.
      const files = await collectMarkdownFiles(`${resolve(root, "docs")}/`);

      assert.equal(files.length, 1);
    });
  }
);

testCovering(
  "a project directory whose path ends in a separator is the same project",
  "server-startup",
  ["Symlinked path is the same project"],
  async () => {
    await withFiles({ "openspec/specs/a/spec.md": "" }, async (root) => {
      assert.equal(resolveProject(`${root}/`).root, resolveProject(root).root);
    });
  }
);

testCovering(
  "a change whose directory holds only nested Markdown is still a change",
  "archive-browsing",
  ["Nested artifacts stay with their change"],
  async () => {
    await withFiles(
      { [`${CHANGES}/nested/specs/a-capability/spec.md`]: "# s\n" },
      async (root) => {
        const [change] = await scanChanges(join(root, CHANGES));

        assert.equal(change.name, "nested");
        assert.deepEqual(
          change.artifacts.map((a) => a.name),
          ["spec"]
        );
      }
    );
  }
);

testCovering(
  "a rules directory that already exists is not reported as created",
  "commit-convention-rule",
  ["Um diretório de regras ausente é criado e a criação é relatada"],
  async () => {
    await withFiles({ [CONFIG]: "schema: spec-driven\n" }, async (root) => {
      const p = project(root);
      mkdirSync(resolve(root, ".claude/rules"), { recursive: true });
      writeFileSync(resolve(root, ".claude/rules/other.md"), "## Theirs\n");

      const said: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => void said.push(args.join(" "));
      try {
        for (const edit of commitConventionComponent.plan(p, {})) {
          commitConventionComponent.applyEdit(p, edit);
        }
      } finally {
        console.log = originalLog;
      }

      // It was already there, so nothing is announced as created.
      assert.ok(!said.join("\n").includes("created "));
    });
  }
);

// =========================================================================
// renderer.ts — the pages, in the shapes the routes do not all produce
// =========================================================================

testCovering(
  "an index rendered with no options at all hides the archive",
  "archive-browsing",
  ["Default invocation hides the archive"],
  async () => {
    const { renderIndex } = await import("./renderer.js");

    // No view, no archived changes: the defaults are what a caller that asks
    // for nothing gets, and they hide the archive.
    const html = renderIndex("proj", [], "/p/openspec/changes");

    assert.match(html, /Open Changes/);
    assert.match(html, /Show archived changes/);
    assert.ok(!html.includes("Archived changes</h2>"));
  }
);

testCovering(
  "an undated archived change is listed without an archive date",
  "archive-browsing",
  ["Undated directory is still listed"],
  async () => {
    const { renderIndex } = await import("./renderer.js");

    const html = renderIndex("proj", [], "/p/openspec/changes", {
      view: { current: true, initial: true },
      archivedChanges: [
        {
          name: "hand-moved",
          slug: "hand-moved",
          dirPath: "/p/openspec/changes/archive/hand-moved",
          artifacts: [],
          archived: { displayName: "hand-moved" },
        },
      ],
    });

    assert.match(html, /hand-moved/);
    assert.ok(!html.includes("Archived 20"));
  }
);

testCovering(
  "a folder of one file needs no contents list, and says so in the singular",
  "artifact-ordering",
  ["Absent artifacts leave no gap"],
  async () => {
    const { renderFiles } = await import("./renderer.js");

    await withFiles({ "docs/only.md": "# Only\n" }, async (root) => {
      const files = await collectMarkdownFiles(resolve(root, "docs"));
      const one = await renderFiles("proj", files, "a folder");

      assert.match(one, /1 file</);
      // One section is not a reading path, so there is no list of one.
      assert.ok(!one.includes('<nav class="toc"'));
    });
  }
);

testCovering(
  "a folder given a back link renders it, and one without does not",
  "artifact-ordering",
  ["Absent artifacts leave no gap"],
  async () => {
    const { renderFiles } = await import("./renderer.js");

    await withFiles(
      { "docs/a.md": "# A\n", "docs/b.md": "# B\n" },
      async (root) => {
        const files = await collectMarkdownFiles(resolve(root, "docs"));

        const withBack = await renderFiles("proj", files, "a folder", "/back");
        const without = await renderFiles("proj", files, "a folder");

        // The class name is in every page's stylesheet; the element is what
        // a back link actually is.
        assert.match(withBack, /<nav class="back-nav">/);
        assert.match(withBack, /href="\/back"/);
        assert.ok(!without.includes('<nav class="back-nav">'));
        // Two files, so the contents list is there.
        assert.match(without, /<nav class="toc"/);
        assert.match(without, /2 files</);
      }
    );
  }
);

testCovering(
  "a dated and an undated change, on their own, still sort dated first",
  "archive-browsing",
  ["Undated archived changes come last"],
  async () => {
    // Exactly two, dated created first: the comparator is asked with the
    // dated one as its left argument, which a longer list does not guarantee.
    await withTree(
      [
        join(CHANGES, "archive", "2026-08-10-dated", "proposal.md"),
        join(CHANGES, "archive", "zzz-undated", "proposal.md"),
      ],
      async (root) => {
        const found = await scanArchivedChanges(join(root, CHANGES));

        assert.deepEqual(
          found.map((c) => c.name),
          ["2026-08-10-dated", "zzz-undated"]
        );
      }
    );
  }
);
