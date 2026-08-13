import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "module";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { runCli } from "./gate/cli-runner.js";
import { REPO_ROOT } from "./gate/scenarios.js";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * The CLI observed the way a user meets it: as a process with arguments, an
 * exit code and two streams. Nothing here starts the server - every case is one
 * the CLI answers and exits from, which is also every case in which an exit
 * code means anything.
 *
 * Standard input is closed for all of these, so any invocation that would have
 * asked a question must instead refuse and say which option supplies it.
 */

const requirePkg = createRequire(import.meta.url);
const pkg = requirePkg("../package.json") as {
  version: string;
  bin: Record<string, string>;
};

/** A minimal OpenSpec project: enough for `init` to accept the directory. */
const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
  "openspec/changes/.keep": "",
};

/** Every file under a tree, relative and sorted - for "nothing was written". */
function treeOf(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(resolve(dir, entry.name), rel);
      else out.push(rel);
    }
  };
  walk(root, "");
  return out.sort();
}

const lastLine = (text: string): string =>
  text.trimEnd().split("\n").pop() ?? "";

// =========================================================================
// 5.2 - the invocation surface
// =========================================================================

testCovering(
  "the package installs exactly one executable, and no second one",
  "cli-interface",
  ["A single executable is installed"],
  () => {
    assert.deepEqual(Object.keys(pkg.bin), ["opsx-tools"]);
    assert.ok(!("opsx-read" in pkg.bin));
    assert.ok(!("opsx-skills" in pkg.bin));
  }
);

testCovering(
  "the root usage lists every capability as a subcommand",
  "cli-interface",
  ["Subcommands are discoverable from the root"],
  () => {
    const { stdout, code } = runCli(["--help"]);

    assert.equal(code, 0);
    for (const sub of ["read", "skill", "init"]) {
      assert.match(stdout, new RegExp(`^\\s+${sub}\\b`, "m"), sub);
    }
  }
);

testCovering(
  "invoked bare, the tool prints usage to standard output and exits zero",
  "cli-interface",
  [
    "Bare invocation prints usage",
    "Bare invocation does not wait for input",
    "Informational actions succeed",
  ],
  () => {
    // Standard input is closed, so this also proves it does not wait for an
    // answer that cannot arrive.
    const { stdout, stderr, code } = runCli([]);

    assert.equal(code, 0);
    assert.match(stdout, /Usage: opsx-tools/);
    assert.equal(stderr, "");
  }
);

testCovering(
  "invoked bare, the tool chooses no capability and writes nothing",
  "cli-interface",
  ["Bare invocation has no side effects"],
  async () => {
    await withFiles(
      { ...PROJECT, ".claude/skills/keep-me/SKILL.md": "theirs\n" },
      async (root) => {
        const before = treeOf(root);

        const { code, output } = runCli([], { cwd: root });

        assert.equal(code, 0);
        assert.deepEqual(treeOf(root), before);
        // No capability ran: no server line, no skills report.
        assert.ok(!/Serving|listening|http:\/\//i.test(output));
        assert.equal(
          readFileSync(resolve(root, ".claude/skills/keep-me/SKILL.md"), "utf8"),
          "theirs\n"
        );
      }
    );
  }
);

testCovering(
  "help is available long and short, at the root and on a subcommand",
  "cli-interface",
  [
    "Long help flag",
    "Short help flag",
    "Help as a bare subcommand",
    "Every subcommand has its own help",
  ],
  () => {
    const long = runCli(["--help"]);
    const short = runCli(["-h"]);
    const bare = runCli(["help"]);

    for (const result of [long, short, bare]) {
      assert.equal(result.code, 0);
      assert.match(result.stdout, /Usage: opsx-tools/);
    }
    assert.equal(short.stdout, long.stdout);
    assert.equal(bare.stdout, long.stdout);

    for (const sub of [["read"], ["skill"], ["init"], ["skill", "install"]]) {
      const result = runCli([...sub, "--help"]);
      assert.equal(result.code, 0, sub.join(" "));
      assert.match(result.stdout, new RegExp(`Usage: opsx-tools ${sub.join(" ")}`));
    }
    assert.equal(
      runCli(["read", "-h"]).stdout,
      runCli(["read", "--help"]).stdout
    );
  }
);

testCovering(
  "asking for help on a subcommand describes that subcommand, not the root",
  "cli-interface",
  ["Subcommand help describes the subcommand", "Option is documented", "Automatic choice is documented"],
  () => {
    const { stdout, code } = runCli(["read", "--help"]);

    assert.equal(code, 0);
    assert.match(stdout, /Usage: opsx-tools read/);
    // Every option the subcommand supports, the target forms, and an example.
    assert.match(stdout, /--port/);
    assert.match(stdout, /-a, --archived/);
    assert.match(stdout, /include archived changes/);
    assert.match(stdout, /TARGET/);
    assert.match(stdout, /EXAMPLES/);
    // The automatic port choice is documented with its range.
    assert.match(stdout, /4242-4999/);
    // And it is not the root listing.
    assert.ok(!/^\s+init\b/m.test(stdout));
  }
);

testCovering(
  "the version is the package's own, on both spellings, with nothing started",
  "cli-interface",
  ["Version flag", "One version for the whole package"],
  () => {
    const long = runCli(["--version"]);
    const short = runCli(["-v"]);

    assert.equal(long.code, 0);
    assert.equal(short.code, 0);
    assert.equal(long.stdout.trim(), pkg.version);
    assert.equal(short.stdout.trim(), pkg.version);
    // No subcommand carries a version of its own.
    assert.equal(runCli(["read", "--version"]).code, 1);
  }
);

// =========================================================================
// 5.3 - usage errors
// =========================================================================

testCovering(
  "an unknown option is named verbatim and is not swallowed",
  "cli-interface",
  ["Unknown option is reported, not swallowed", "Usage errors fail"],
  () => {
    const { stdout, stderr, code } = runCli(["read", "--bananas"]);

    assert.equal(code, 1);
    assert.match(stderr, /--bananas/);
    assert.match(stderr, /unknown option/i);
    assert.equal(stdout, "");
  }
);

testCovering(
  "a mistyped option is the reported problem, and gets a suggestion",
  "cli-interface",
  ["Mistyped option does not become a target", "Near-miss option gets a suggestion"],
  () => {
    const { stderr, code } = runCli(["read", "--prot", "8080"]);

    assert.equal(code, 1);
    assert.match(stderr, /--prot/);
    // The remaining argument is not reinterpreted as a target.
    assert.ok(!/8080.*not found/s.test(stderr));
    assert.ok(!/Target '8080'/.test(stderr));
    // And the near miss is offered.
    assert.match(stderr, /--port/);
  }
);

testCovering(
  "an unknown subcommand is rejected, and points at the root help",
  "cli-interface",
  ["Unknown subcommand is rejected", "A failure before a subcommand points at the root"],
  () => {
    const { stderr, code } = runCli(["raed"]);

    assert.equal(code, 1);
    assert.match(stderr, /raed/);
    assert.match(stderr, /unknown command/i);
    assert.equal(lastLine(stderr), "Run 'opsx-tools --help' for usage.");
  }
);

testCovering(
  "an invalid port value is a usage error",
  "cli-interface",
  ["Invalid port value is still a usage error"],
  () => {
    const { stderr, code } = runCli(["read", "--port", "abc"]);

    assert.equal(code, 1);
    assert.match(stderr, /Port must be a number/);
  }
);

testCovering(
  "every usage error ends by pointing at the failing command's own help",
  "cli-interface",
  ["Failed invocation offers a next step", "The suggested help matches the failing subcommand"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const failures = [
        ["read", "--bananas"],
        ["read", "--port", "abc"],
        ["read", "no-such-change"],
      ];

      for (const args of failures) {
        const { stderr, code } = runCli(args, { cwd: root });

        assert.equal(code, 1, args.join(" "));
        assert.equal(
          lastLine(stderr),
          "Run 'opsx-tools read --help' for usage.",
          args.join(" ")
        );
      }
    });
  }
);

testCovering(
  "the error is not buried under the usage listing",
  "cli-interface",
  ["Error is not buried under usage text"],
  () => {
    const { stderr } = runCli(["read", "--bananas"]);

    // The error is the first thing read, and the full listing is absent.
    assert.match(stderr.split("\n")[0], /--bananas/);
    assert.ok(!stderr.includes("Usage: opsx-tools read"));
    assert.ok(!stderr.includes("TARGET"));
    assert.ok(!stderr.includes("EXAMPLES"));
  }
);

// =========================================================================
// 5.4 - the target that cannot be resolved
// =========================================================================

testCovering(
  "an unresolvable target names itself and lists every location tried",
  "cli-interface",
  ["Unresolvable target lists both attempts", "An unresolvable positional word is a target error"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { stderr, code } = runCli(["read", "teste"], { cwd: root });

      assert.equal(code, 1);
      assert.match(stderr, /Target 'teste' not found/);
      assert.match(stderr, /\.\/teste/);
      assert.match(stderr, /openspec\/changes\/teste/);
      assert.match(stderr, /openspec\/changes\/archive\/teste/);
      // A positional word is a target, never an unknown command.
      assert.ok(!/unknown command/i.test(stderr));
    });
  }
);

testCovering(
  "a name close to an open change is offered as a suggestion",
  "cli-interface",
  ["Close match is suggested"],
  async () => {
    await withFiles(
      { ...PROJECT, "openspec/changes/add-dark-mode/proposal.md": "# p\n" },
      async (root) => {
        const { stderr, code } = runCli(["read", "add-dark-mod"], { cwd: root });

        assert.equal(code, 1);
        assert.match(stderr, /Did you mean\?/);
        assert.match(stderr, /add-dark-mode/);
      }
    );
  }
);

testCovering(
  "with no close match, the open changes are listed by name",
  "cli-interface",
  ["Available changes are listed when no close match exists"],
  async () => {
    await withFiles(
      {
        ...PROJECT,
        "openspec/changes/add-dark-mode/proposal.md": "# p\n",
        "openspec/changes/remove-legacy-api/proposal.md": "# p\n",
      },
      async (root) => {
        const { stderr, code } = runCli(["read", "zzzzzzzzzzzz"], { cwd: root });

        assert.equal(code, 1);
        assert.match(stderr, /Available open changes:/);
        assert.match(stderr, /add-dark-mode/);
        assert.match(stderr, /remove-legacy-api/);
        assert.ok(!/Did you mean\?/.test(stderr));
      }
    );
  }
);

testCovering(
  "with no open changes at all, that is stated rather than listed as nothing",
  "cli-interface",
  ["Empty change set is stated"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { stderr, code } = runCli(["read", "zzzzzzzzzzzz"], { cwd: root });

      assert.equal(code, 1);
      assert.match(stderr, /There are no open changes in openspec\/changes\//);
      assert.ok(!/Available open changes:/.test(stderr));
    });
  }
);

testCovering(
  "an archived name is suggested, and marked as archived",
  "cli-interface",
  ["Archived name is suggested and marked"],
  async () => {
    await withFiles(
      {
        ...PROJECT,
        "openspec/changes/archive/2026-08-10-improve-cli-errors/proposal.md":
          "# p\n",
      },
      async (root) => {
        const { stderr, code } = runCli(["read", "improve-cli-errrors"], {
          cwd: root,
        });

        assert.equal(code, 1);
        assert.match(stderr, /Did you mean\?/);
        assert.match(stderr, /improve-cli-errors\s+\(archived\)/);
      }
    );
  }
);

// =========================================================================
// 5.5 - the non-interactive paths of init and skill
// =========================================================================

testCovering(
  "provisioning is reached through init, and supplied options skip every prompt",
  "cli-interface",
  ["Provisioning is reached through the init subcommand"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { code, output } = runCli(["init", "--commit-rule", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 0, output);
      assert.ok(existsSync(resolve(root, ".claude/rules/commit-convention.md")));
      assert.match(
        readFileSync(resolve(root, ".claude/rules/commit-convention.md"), "utf8"),
        /type\(scope\): description/
      );
    });
  }
);

testCovering(
  "with every choice supplied, provisioning runs without prompting and exits zero",
  "project-provisioning",
  [
    "Supplied choices skip the prompts",
    "Confirmation can be answered in advance",
    "Completing successfully exits zero",
  ],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { code, output } = runCli(["init", "--lang", "pt-BR", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 0, output);
      // Nothing was asked: input was closed, and a prompt would have refused.
      assert.ok(!/must be supplied when input is not a terminal/.test(output));
      assert.match(
        readFileSync(resolve(root, "openspec/config.yaml"), "utf8"),
        /Português \(Brasil\)/
      );
    });
  }
);

testCovering(
  "a choice that cannot be asked is refused, naming the option that supplies it",
  "project-provisioning",
  ["Missing choice without a terminal is an error"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      // No component flags at all: the selection itself is the missing choice.
      const { stderr, code } = runCli(["init"], { cwd: root });

      assert.equal(code, 1);
      assert.match(stderr, /must be supplied when input is not a terminal/);
      assert.match(stderr, /--lang/);
      assert.match(stderr, /--commit-rule/);
      assert.deepEqual(treeOf(root), before, "nothing was written");
    });
  }
);

testCovering(
  "provisioning where there is no OpenSpec project exits one and writes nothing",
  "project-provisioning",
  ["An unmet precondition exits one", "The precondition is checked before anything is asked"],
  async () => {
    await withFiles({ "README.md": "# Not a project\n" }, async (root) => {
      const before = treeOf(root);

      const { stderr, code } = runCli(["init", "--commit-rule", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 1);
      assert.match(stderr, /No OpenSpec project here/);
      assert.match(stderr, /openspec init/);
      // Refused before anything was asked or written.
      assert.deepEqual(treeOf(root), before);
    });
  }
);

testCovering(
  "a skill named with a destination and the waiver installs without prompting",
  "skill-installation",
  ["Scripted install", "Fully specified invocation still works non-interactively"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { code, output } = runCli(
        ["skill", "install", "openspec-review-change", "--project", "--yes"],
        { cwd: root }
      );

      assert.equal(code, 0, output);
      const installed = resolve(
        root,
        ".claude/skills/openspec-review-change/SKILL.md"
      );
      assert.ok(existsSync(installed));
      // The source is the package, not the working directory.
      assert.equal(
        readFileSync(installed, "utf8"),
        readFileSync(
          resolve(REPO_ROOT, "skills/openspec-review-change/SKILL.md"),
          "utf8"
        )
      );
      assert.ok(!/must be supplied when input is not a terminal/.test(output));
    });
  }
);

testCovering(
  "installing without a destination refuses rather than choosing one",
  "skill-installation",
  ["Piped invocation that needs a destination"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      const { stderr, code } = runCli(
        ["skill", "install", "openspec-review-change"],
        { cwd: root }
      );

      assert.equal(code, 1);
      assert.match(stderr, /A destination must be supplied/);
      assert.match(stderr, /--project/);
      assert.match(stderr, /--user/);
      assert.deepEqual(treeOf(root), before, "nothing was installed");
    });
  }
);

testCovering(
  "an unknown skill name is answered with the names the package ships",
  "skill-installation",
  ["Unknown skill name lists the real ones", "Every usage error offers a next step"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { stderr, code } = runCli(
        ["skill", "install", "no-such-skill", "--project", "--yes"],
        { cwd: root }
      );

      assert.equal(code, 1);
      assert.match(stderr, /Unknown skill: no-such-skill/);
      assert.match(stderr, /openspec-review-change/);
      assert.equal(
        lastLine(stderr),
        "Run 'opsx-tools skill install --help' for usage."
      );
      assert.ok(!stderr.includes("EXAMPLES"));
    });
  }
);

testCovering(
  "removing a skill that is not installed there deletes nothing and exits zero",
  "skill-installation",
  ["Removing what is not installed"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      const { code, output } = runCli(
        ["skill", "remove", "openspec-review-change", "--project", "--yes"],
        { cwd: root }
      );

      assert.equal(code, 0, output);
      assert.deepEqual(treeOf(root), before);
    });
  }
);

testCovering(
  "removing names the absolute path it is about to delete",
  "skill-installation",
  ["Removal names its targets before deleting"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      runCli(
        ["skill", "install", "openspec-review-change", "--project", "--yes"],
        { cwd: root }
      );
      const target = resolve(root, ".claude/skills/openspec-review-change");
      assert.ok(existsSync(target));

      const { code, output } = runCli(
        ["skill", "remove", "openspec-review-change", "--project", "--yes"],
        { cwd: root }
      );

      assert.equal(code, 0, output);
      assert.ok(output.includes(target), "the absolute path is named");
      assert.ok(!existsSync(target));
    });
  }
);

testCovering(
  "installing over an identical copy writes nothing and asks nothing",
  "skill-installation",
  ["Identical copy is a no-op"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const args = [
        "skill",
        "install",
        "openspec-review-change",
        "--project",
        "--yes",
      ];
      runCli(args, { cwd: root });
      const after = treeOf(root);

      const second = runCli(args, { cwd: root });

      assert.equal(second.code, 0);
      assert.match(second.output, /already installed/i);
      assert.deepEqual(treeOf(root), after);
    });
  }
);

testCovering(
  "a skill directory the package does not ship is never listed or touched",
  "skill-installation",
  ["Unrelated installed skills are untouched"],
  async () => {
    await withFiles(
      { ...PROJECT, ".claude/skills/someone-elses/SKILL.md": "theirs\n" },
      async (root) => {
        const listed = runCli(["skill", "list", "--project"], { cwd: root });
        assert.equal(listed.code, 0);
        assert.ok(!listed.output.includes("someone-elses"));

        runCli(
          ["skill", "remove", "openspec-review-change", "--project", "--yes"],
          { cwd: root }
        );

        assert.equal(
          readFileSync(resolve(root, ".claude/skills/someone-elses/SKILL.md"), "utf8"),
          "theirs\n"
        );
      }
    );
  }
);

testCovering(
  "the installer's own help and version are informational and install nothing",
  "skill-installation",
  ["Help and version are informational"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      const help = runCli(["skill", "--help"], { cwd: root });
      const version = runCli(["--version"], { cwd: root });

      assert.equal(help.code, 0);
      assert.match(help.stdout, /Usage: opsx-tools skill/);
      assert.equal(version.code, 0);
      assert.equal(version.stdout.trim(), pkg.version);
      assert.deepEqual(treeOf(root), before);
    });
  }
);

testCovering(
  "an option the installer does not recognize is rejected, and nothing is written",
  "skill-installation",
  ["Unknown option is rejected"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      const { stderr, code } = runCli(
        ["skill", "install", "openspec-review-change", "--bananas"],
        { cwd: root }
      );

      assert.equal(code, 1);
      assert.match(stderr, /--bananas/);
      assert.deepEqual(treeOf(root), before);
    });
  }
);

testCovering(
  "state is reported for both destinations without anything being written",
  "skill-installation",
  ["State is shown before it is edited"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      const { stdout, code } = runCli(["skill", "list"], { cwd: root });

      assert.equal(code, 0);
      assert.match(stdout, /project \(/);
      assert.match(stdout, /^user\b/m);
      assert.match(stdout, /openspec-review-change/);
      assert.deepEqual(treeOf(root), before);
    });
  }
);
