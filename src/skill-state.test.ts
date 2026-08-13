import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";
import {
  destinations,
  ensureSkillsDir,
  findDestination,
  installedPath,
  RESTART_CAVEAT,
} from "./skill-destinations.js";
import { describeState, skillState } from "./skill-state.js";
import { resolveProject } from "./project.js";
import { testCovering, withFiles } from "./test-fixture.js";
import type { Destination, PackagedSkill } from "./types.js";

/**
 * Where a skill goes, and what is already there. Both are derived from disk
 * every time they are asked for - nothing is written at install time to be read
 * back - so a copy placed by hand is classified exactly like one the installer
 * put there.
 */

/** A packaged skill laid out in a fixture tree, so no real one is touched. */
const PACKAGED_FILES: Record<string, string> = {
  "packaged/demo/SKILL.md": "---\nname: demo\n---\n\nThe instruction.\n",
  "packaged/demo/references/notes.md": "A reference file.\n",
};

const packagedSkill = (root: string): PackagedSkill => ({
  name: "demo",
  path: resolve(root, "packaged/demo"),
});

const destAt = (dir: string): Destination => ({
  id: "project",
  label: "project (fixture)",
  skillsDir: dir,
});

// --- destinations ---------------------------------------------------------

testCovering(
  "both destinations are offered, each carrying the absolute path it would write",
  "skill-installation",
  ["Both destinations offered"],
  async () => {
    await withFiles({ "openspec/specs/a/spec.md": "" }, async (root) => {
      const offered = destinations(root);

      assert.deepEqual(
        offered.map((d) => d.id),
        ["project", "user"]
      );
      for (const dest of offered) {
        assert.ok(dest.skillsDir.startsWith("/"), "an absolute path");
        assert.ok(dest.skillsDir.endsWith("/.claude/skills"));
      }
      assert.equal(
        offered[1].skillsDir,
        resolve(homedir(), ".claude", "skills")
      );
      // The project destination is named with the project, so the user can see
      // which one they are approving a write to.
      assert.match(offered[0].label, /project \(/);
    });
  }
);

testCovering(
  "the project destination is resolved by the same rule the reader uses",
  "skill-installation",
  ["Project root is resolved consistently"],
  async () => {
    await withFiles(
      { "openspec/specs/a/spec.md": "", "src/deep/file.ts": "" },
      async (root) => {
        const deep = resolve(root, "src/deep");

        const fromRoot = findDestination("project", root);
        const fromDeep = findDestination("project", deep);

        assert.equal(fromDeep.skillsDir, fromRoot.skillsDir);
        // The same root the reader resolves for its port.
        assert.equal(
          fromDeep.skillsDir,
          resolve(resolveProject(deep).root, ".claude", "skills")
        );
      }
    );
  }
);

testCovering(
  "a destination directory that does not exist is created, and the creation is reported",
  "skill-installation",
  ["Missing destination directory is created"],
  async () => {
    await withFiles({ "openspec/specs/a/spec.md": "" }, async (root) => {
      const dest = findDestination("project", root);
      assert.ok(!existsSync(dest.skillsDir));

      const first = ensureSkillsDir(dest);

      assert.deepEqual(first, { created: true });
      assert.ok(existsSync(dest.skillsDir));
      // Said out loud, because a directory that did not exist when the AI tool
      // started is only picked up after a restart.
      assert.match(RESTART_CAVEAT, /restarted/);

      // Already there the second time, so nothing is claimed to be created.
      assert.deepEqual(ensureSkillsDir(dest), { created: false });
    });
  }
);

test("the user destination is under the home directory, never the project", async () => {
  await withFiles({ "openspec/specs/a/spec.md": "" }, async (root) => {
    const user = findDestination("user", root);

    assert.equal(user.skillsDir, resolve(homedir(), ".claude", "skills"));
    assert.ok(!user.skillsDir.startsWith(resolve(root) + "/"));
  });
});

test("a skill's installed path is its name under the destination", () => {
  const dest = destAt("/p/.claude/skills");

  assert.equal(installedPath(dest, "review"), "/p/.claude/skills/review");
});

// --- installed state ------------------------------------------------------

test("a skill that is not there is absent", async () => {
  await withFiles(PACKAGED_FILES, async (root) => {
    const dest = destAt(resolve(root, "dest"));

    assert.deepEqual(skillState(packagedSkill(root), dest), { kind: "absent" });
  });
});

testCovering(
  "a skill copied into place by hand is recognized as installed",
  "skill-installation",
  ["Hand-copied skill is recognized"],
  async () => {
    await withFiles(PACKAGED_FILES, async (root) => {
      const dest = destAt(resolve(root, "dest"));
      mkdirSync(dest.skillsDir, { recursive: true });

      // Copied by hand: no installer ran, so no record of one exists.
      cpSync(resolve(root, "packaged/demo"), resolve(dest.skillsDir, "demo"), {
        recursive: true,
      });

      assert.deepEqual(skillState(packagedSkill(root), dest), {
        kind: "identical",
      });
      assert.equal(describeState({ kind: "identical" }), "installed");
    });
  }
);

testCovering(
  "an installed copy whose contents differ is distinguished from an identical one",
  "skill-installation",
  ["Locally edited skill is distinguished"],
  async () => {
    await withFiles(PACKAGED_FILES, async (root) => {
      const dest = destAt(resolve(root, "dest"));
      mkdirSync(dest.skillsDir, { recursive: true });
      cpSync(resolve(root, "packaged/demo"), resolve(dest.skillsDir, "demo"), {
        recursive: true,
      });

      writeFileSync(
        resolve(dest.skillsDir, "demo/SKILL.md"),
        "---\nname: demo\n---\n\nTheir own edit.\n"
      );

      assert.deepEqual(skillState(packagedSkill(root), dest), {
        kind: "differs",
      });
      assert.match(describeState({ kind: "differs" }), /differs from the packaged copy/);
    });
  }
);

test("a difference in a reference file beside SKILL.md is a difference too", async () => {
  await withFiles(PACKAGED_FILES, async (root) => {
    const dest = destAt(resolve(root, "dest"));
    mkdirSync(dest.skillsDir, { recursive: true });
    cpSync(resolve(root, "packaged/demo"), resolve(dest.skillsDir, "demo"), {
      recursive: true,
    });

    // A stale reference is as much of a difference as a stale instruction.
    writeFileSync(
      resolve(dest.skillsDir, "demo/references/notes.md"),
      "Their own note.\n"
    );

    assert.deepEqual(skillState(packagedSkill(root), dest), { kind: "differs" });
  });
});

test("an extra file at the destination is a difference", async () => {
  await withFiles(PACKAGED_FILES, async (root) => {
    const dest = destAt(resolve(root, "dest"));
    mkdirSync(dest.skillsDir, { recursive: true });
    cpSync(resolve(root, "packaged/demo"), resolve(dest.skillsDir, "demo"), {
      recursive: true,
    });

    writeFileSync(resolve(dest.skillsDir, "demo/extra.md"), "Extra.\n");

    assert.deepEqual(skillState(packagedSkill(root), dest), { kind: "differs" });
  });
});

test("a file where the skill directory should be is unreadable, not differing", async () => {
  await withFiles(
    { ...PACKAGED_FILES, "dest/demo": "not a directory\n" },
    async (root) => {
      const dest = destAt(resolve(root, "dest"));

      const state = skillState(packagedSkill(root), dest);

      assert.equal(state.kind, "unreadable");
      if (state.kind !== "unreadable") return;
      assert.match(state.reason, /not a directory/);
      assert.match(describeState(state), /present but unreadable/);
    }
  );
});

testCovering(
  "the same skill is reported separately for each destination",
  "skill-installation",
  ["State is reported per destination"],
  async () => {
    await withFiles(PACKAGED_FILES, async (root) => {
      const installed = destAt(resolve(root, "one"));
      const empty = destAt(resolve(root, "two"));
      mkdirSync(installed.skillsDir, { recursive: true });
      cpSync(
        resolve(root, "packaged/demo"),
        resolve(installed.skillsDir, "demo"),
        { recursive: true }
      );

      assert.deepEqual(skillState(packagedSkill(root), installed), {
        kind: "identical",
      });
      assert.deepEqual(skillState(packagedSkill(root), empty), {
        kind: "absent",
      });
    });
  }
);

test("each state reads in the terms the user has to act on", () => {
  assert.equal(describeState({ kind: "absent" }), "not installed");
  assert.equal(describeState({ kind: "identical" }), "installed");
  assert.equal(
    describeState({ kind: "differs" }),
    "installed, differs from the packaged copy"
  );
  assert.equal(
    describeState({ kind: "unreadable", reason: "EACCES" }),
    "present but unreadable (EACCES)"
  );
});
