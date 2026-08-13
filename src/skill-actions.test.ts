import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  ALWAYS_YES,
  assign,
  installAssignments,
  removeAssignments,
  type Confirm,
} from "./skill-actions.js";
import { listPackagedSkills, packagedSkillsDir } from "./skill-source.js";
import { runCli, runCliInteractive } from "./gate/cli-runner.js";
import { REPO_ROOT } from "./gate/scenarios.js";
import { testCovering, withFiles } from "./test-fixture.js";
import type { Destination, PackagedSkill } from "./types.js";

/**
 * Installing and removing, with the confirmation supplied by the caller. The
 * question is a parameter of these functions rather than something they ask
 * themselves, which is what lets a test answer *no* - the one thing a closed
 * stdin cannot express, because it makes the CLI refuse before it asks.
 */

const PACKAGED: Record<string, string> = {
  "packaged/demo/SKILL.md": "---\nname: demo\n---\n\nThe instruction.\n",
  "packaged/demo/references/notes.md": "A reference file.\n",
};

const skill = (root: string): PackagedSkill => ({
  name: "demo",
  path: resolve(root, "packaged/demo"),
});

const destAt = (dir: string, id: "project" | "user" = "project"): Destination => ({
  id,
  label: `${id} (fixture)`,
  skillsDir: dir,
});

/** Records every question asked, and answers them all the same way. */
function answering(answer: boolean): Confirm & { asked: string[] } {
  const asked: string[] = [];
  const confirm = (async (message: string) => {
    asked.push(message);
    return answer;
  }) as Confirm & { asked: string[] };
  confirm.asked = asked;
  return confirm;
}

/** Installs the packaged fixture at `dest`, then edits it so it differs. */
function installEdited(root: string, dest: Destination): string {
  mkdirSync(dest.skillsDir, { recursive: true });
  cpSync(resolve(root, "packaged/demo"), resolve(dest.skillsDir, "demo"), {
    recursive: true,
  });
  const edited = resolve(dest.skillsDir, "demo/SKILL.md");
  writeFileSync(edited, "---\nname: demo\n---\n\nTheir own edit.\n");
  return edited;
}

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
};

// =========================================================================
// The source
// =========================================================================

testCovering(
  "the skills come from the package, not from the working directory",
  "skill-installation",
  ["Source is the package, not the working directory"],
  async () => {
    await withFiles(
      { ...PROJECT, "skills/decoy/SKILL.md": "---\nname: decoy\n---\n" },
      async (root) => {
        // A `skills/` directory in the user's own project must not be read as
        // the packaged set: the installer is run from wherever the user stands.
        const { stdout, code } = runCli(["skill", "list", "--project"], {
          cwd: root,
        });

        assert.equal(code, 0);
        assert.ok(!stdout.includes("decoy"));
        for (const packaged of listPackagedSkills()) {
          assert.ok(stdout.includes(packaged.name), packaged.name);
        }
        // And the packaged directory is the one beside the package's own code.
        assert.equal(packagedSkillsDir(), resolve(REPO_ROOT, "skills"));
      }
    );
  }
);

testCovering(
  "a package shipping no skills says so and does nothing",
  "skill-installation",
  ["No packaged skills"],
  async () => {
    await withFiles(PACKAGED, async (root) => {
      // No packaged skills means no assignments at all: nothing is listed,
      // nothing is written, and no destination is touched.
      const dest = destAt(resolve(root, "dest"));

      const pairs = assign([], [dest]);

      assert.deepEqual(pairs, []);
      await installAssignments(pairs, ALWAYS_YES);
      assert.ok(!existsSync(dest.skillsDir), "no destination directory was made");
    });
  }
);

// =========================================================================
// Destinations
// =========================================================================

testCovering(
  "both destinations in one invocation are each reported separately",
  "skill-installation",
  ["Both destinations in one invocation"],
  async () => {
    await withFiles(PACKAGED, async (root) => {
      const project = destAt(resolve(root, "project-dest"), "project");
      const user = destAt(resolve(root, "user-dest"), "user");

      const pairs = assign([skill(root)], [project, user]);
      await installAssignments(pairs, ALWAYS_YES);

      assert.deepEqual(
        pairs.map((p) => p.dest.id),
        ["project", "user"]
      );
      for (const dest of [project, user]) {
        assert.ok(
          existsSync(resolve(dest.skillsDir, "demo/SKILL.md")),
          `installed at ${dest.id}`
        );
      }
    });
  }
);

testCovering(
  "a destination supplied on the command line is never questioned",
  "skill-installation",
  ["Supplied destination is not questioned"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const one = listPackagedSkills()[0].name;

      // Through a terminal, so a question *could* have been asked.
      const { code, output } = runCliInteractive(
        ["skill", "install", one, "--project", "--yes"],
        { cwd: root, answers: "" }
      );

      assert.equal(code, 0, output);
      assert.ok(!output.includes("Where should the skills be installed?"));
      assert.ok(existsSync(resolve(root, ".claude/skills", one, "SKILL.md")));
    });
  }
);

testCovering(
  "with no destination named, the installer asks before writing anything",
  "skill-installation",
  ["Destination is asked when not supplied"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const one = listPackagedSkills()[0].name;

      // Enter accepts the checkbox with nothing selected, which is enough to
      // show the question was put before anything was written.
      const { output } = runCliInteractive(["skill", "install", one], {
        cwd: root,
        answers: "\n",
      });

      assert.match(output, /Where should the skills be installed\?/);
      assert.ok(!existsSync(resolve(root, ".claude/skills")));
    });
  }
);

// =========================================================================
// Overwriting and removing
// =========================================================================

testCovering(
  "a differing copy is reported and asked about, and declining leaves it alone",
  "skill-installation",
  ["Differing copy prompts before overwrite"],
  async () => {
    await withFiles(PACKAGED, async (root) => {
      const dest = destAt(resolve(root, "dest"));
      const edited = installEdited(root, dest);
      const before = readFileSync(edited, "utf8");

      const confirm = answering(false);
      await installAssignments(assign([skill(root)], [dest]), confirm);

      assert.equal(confirm.asked.length, 1);
      assert.match(confirm.asked[0], /^Overwrite /);
      // Declining leaves the installed copy exactly as it was.
      assert.equal(readFileSync(edited, "utf8"), before);

      // And accepting replaces it with the packaged one.
      await installAssignments(assign([skill(root)], [dest]), ALWAYS_YES);
      assert.equal(
        readFileSync(edited, "utf8"),
        readFileSync(resolve(root, "packaged/demo/SKILL.md"), "utf8")
      );
    });
  }
);

testCovering(
  "removing a modified copy calls the modification out in the confirmation",
  "skill-installation",
  ["Removing a modified skill is called out"],
  async () => {
    await withFiles(PACKAGED, async (root) => {
      const dest = destAt(resolve(root, "dest"));
      const edited = installEdited(root, dest);

      const lines: string[] = [];
      const originalLog = console.log;
      console.log = (message?: unknown) => void lines.push(String(message ?? ""));
      try {
        const confirm = answering(false);
        const removed = await removeAssignments(
          assign([skill(root)], [dest]),
          confirm
        );
        assert.equal(removed, false);
        assert.equal(confirm.asked.length, 1);
      } finally {
        console.log = originalLog;
      }

      const named = lines.join("\n");
      assert.match(named, /These directories will be deleted:/);
      assert.match(named, /has local modifications/);
      // Declining deletes nothing.
      assert.ok(existsSync(edited));
    });
  }
);

// =========================================================================
// The bare invocation
// =========================================================================

testCovering(
  "the bare invocation shows every skill at every destination as an editable selection",
  "cli-interface",
  ["Skill management is reached through the skill subcommand"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { code, output } = runCliInteractive(["skill"], {
        cwd: root,
        answers: "\n",
      });

      assert.equal(code, 0);
      assert.match(output, /Check to install, clear to remove/);
      for (const packaged of listPackagedSkills()) {
        assert.ok(output.includes(packaged.name), packaged.name);
      }
    });
  }
);

testCovering(
  "a selection that changes nothing writes nothing and exits zero",
  "skill-installation",
  ["Unchanged selection does nothing"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      // Nothing installed, and nothing checked: the selection is unchanged.
      const { code, output } = runCliInteractive(["skill"], {
        cwd: root,
        answers: "\n",
      });

      assert.equal(code, 0);
      assert.match(output, /Nothing to change\./);
      assert.ok(!existsSync(resolve(root, ".claude/skills")));
    });
  }
);

testCovering(
  "the edits are listed as writes and deletions before the confirmation",
  "skill-installation",
  ["Edits are summarized before being applied"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      // One installed already; checking everything means one write for each
      // of the others, and the summary has to name them before it asks.
      const first = listPackagedSkills()[0].name;
      runCli(["skill", "install", first, "--project", "--yes"], { cwd: root });

      // "a" checks every row, then Enter submits, then the confirmation is
      // declined so that nothing is applied and the summary is what is tested.
      const { output } = runCliInteractive(["skill"], {
        cwd: root,
        answers: "a\nn\n",
      });

      assert.match(output, /Will be written:/);
      assert.match(output, /Apply these changes\?/);
      assert.match(output, /Nothing was written or deleted\./);
      // Named by absolute path, under the destination that would receive them.
      assert.ok(output.includes(resolve(root, ".claude/skills")), output);
    });
  }
);

test("a skill directory the package does not ship is never a target", async () => {
  await withFiles(PACKAGED, async (root) => {
    const dest = destAt(resolve(root, "dest"));
    mkdirSync(resolve(dest.skillsDir, "someone-elses"), { recursive: true });
    writeFileSync(resolve(dest.skillsDir, "someone-elses/SKILL.md"), "theirs\n");

    await removeAssignments(assign([skill(root)], [dest]), ALWAYS_YES);

    assert.deepEqual(readdirSync(dest.skillsDir), ["someone-elses"]);
  });
});
