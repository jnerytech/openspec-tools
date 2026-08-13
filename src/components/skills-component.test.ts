import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { skillsComponent } from "./skills.js";
import { listPackagedSkills } from "../skill-source.js";
import { testCovering, withFiles } from "../test-fixture.js";
import type { Edit } from "../component.js";
import type { ProjectIdentity } from "../types.js";

/**
 * The skills the package ships, provisioned as one item: what the row reports
 * about the project, and what selecting or clearing it does.
 *
 * Every case works on a fixture project, so the destination the component
 * resolves is inside the fixture and no real skills directory is touched.
 */

const project = (root: string): ProjectIdentity => ({
  root,
  name: basename(root),
  source: "openspec",
});

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
};

const skillsDir = (root: string): string => resolve(root, ".claude/skills");
const packaged = (): string[] => listPackagedSkills().map((s) => s.name);

function apply(p: ProjectIdentity, edits: Edit[]): void {
  for (const edit of edits) skillsComponent.applyEdit(p, edit);
}

/** Provisions every packaged skill into the fixture's project destination. */
function install(root: string): void {
  const p = project(root);
  apply(p, skillsComponent.plan(p, { dests: [projectDest(root)] }));
}

function projectDest(root: string): { id: "project"; label: string; skillsDir: string } {
  return { id: "project", label: `project (${basename(root)})`, skillsDir: skillsDir(root) };
}

// =========================================================================
// What the row reports
// =========================================================================

testCovering(
  "with nothing installed the row reports the component as absent",
  "project-provisioning",
  ["Every component is listed"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      assert.deepEqual(skillsComponent.inspect(project(root)), { kind: "absent" });
    });
  }
);

testCovering(
  "with every skill installed the row reports how many, and as provisioned",
  "project-provisioning",
  ["A provisioned component is shown as provisioned"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      install(root);

      const state = skillsComponent.inspect(project(root));

      assert.equal(state.kind, "provisioned");
      if (state.kind !== "provisioned") return;
      assert.equal(state.detail, `${packaged().length} installed`);
    });
  }
);

testCovering(
  "with only some installed the row says how many of how many",
  "project-provisioning",
  ["A provisioned component is shown as provisioned"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      install(root);
      // Remove one, so the destination holds a strict subset.
      rmSync(resolve(skillsDir(root), packaged()[0]), {
        recursive: true,
        force: true,
      });

      const state = skillsComponent.inspect(project(root));

      assert.equal(state.kind, "provisioned");
      if (state.kind !== "provisioned") return;
      assert.equal(
        state.detail,
        `${packaged().length - 1}/${packaged().length} installed`
      );
    });
  }
);

testCovering(
  "an installed copy that was edited makes the row report a difference",
  "project-provisioning",
  ["A provisioned component is shown as provisioned"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      install(root);
      writeFileSync(
        resolve(skillsDir(root), packaged()[0], "SKILL.md"),
        "---\nname: edited\n---\n\nTheir own text.\n"
      );

      const state = skillsComponent.inspect(project(root));

      assert.equal(state.kind, "differs");
      if (state.kind !== "differs") return;
      assert.match(state.detail, /installed/);
    });
  }
);

testCovering(
  "a skill path that is not a directory makes the row unsafe",
  "project-provisioning",
  ["A provisioned component is shown as provisioned"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      mkdirSync(skillsDir(root), { recursive: true });
      // A file where a skill directory is expected: unreadable, not differing.
      writeFileSync(resolve(skillsDir(root), packaged()[0]), "not a directory\n");

      const state = skillsComponent.inspect(project(root));

      assert.equal(state.kind, "unsafe");
      if (state.kind !== "unsafe") return;
      assert.match(state.reason, /not a directory/);
    });
  }
);

// =========================================================================
// What the plan carries
// =========================================================================

testCovering(
  "selecting the component plans a write for every packaged skill",
  "project-provisioning",
  ["Selecting skills provisions all of them", "New files are named by path"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);

      const edits = skillsComponent.plan(p, { dests: [projectDest(root)] });

      assert.equal(edits.length, packaged().length);
      for (const edit of edits) {
        assert.equal(edit.kind, "path");
        if (edit.kind !== "path") continue;
        assert.equal(edit.action, "write");
        assert.ok(edit.path.startsWith(skillsDir(root)));
      }
    });
  }
);

testCovering(
  "a skill already identical is not planned again",
  "project-provisioning",
  ["Applying an unchanged selection is a no-op"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      install(root);

      assert.deepEqual(skillsComponent.plan(p, { dests: [projectDest(root)] }), []);
    });
  }
);

testCovering(
  "a plan over an edited copy says it will be replaced",
  "project-provisioning",
  ["An edit inside an existing file is shown as a diff"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      install(root);
      writeFileSync(
        resolve(skillsDir(root), packaged()[0], "SKILL.md"),
        "edited\n"
      );

      const [edit] = skillsComponent.plan(p, { dests: [projectDest(root)] });

      assert.equal(edit.kind, "path");
      if (edit.kind !== "path") return;
      assert.match(edit.note ?? "", /differs from the packaged copy/);
    });
  }
);

testCovering(
  "a plan over an unreadable copy says so rather than pretending",
  "project-provisioning",
  ["Deletions are named by path"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      mkdirSync(skillsDir(root), { recursive: true });
      writeFileSync(resolve(skillsDir(root), packaged()[0]), "not a directory\n");

      const edits = skillsComponent.plan(p, { dests: [projectDest(root)] });
      const named = edits.find(
        (e) => e.kind === "path" && e.path.endsWith(packaged()[0])
      );

      assert.ok(named);
      assert.match(
        (named as { note?: string }).note ?? "",
        /present but unreadable/
      );
    });
  }
);

// =========================================================================
// Clearing the row
// =========================================================================

testCovering(
  "clearing the row plans a deletion for what is installed in the project",
  "project-provisioning",
  ["Deselecting a provisioned component removes it", "Deletions are named by path"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      install(root);

      const edits = skillsComponent.plan(p, null);

      assert.equal(edits.length, packaged().length);
      for (const edit of edits) {
        assert.equal(edit.kind, "path");
        if (edit.kind !== "path") continue;
        assert.equal(edit.action, "delete");
      }

      apply(p, edits);
      for (const name of packaged()) {
        assert.ok(!existsSync(resolve(skillsDir(root), name)));
      }
    });
  }
);

testCovering(
  "clearing a row that is already empty plans nothing",
  "project-provisioning",
  ["Applying an unchanged selection is a no-op"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      assert.deepEqual(skillsComponent.plan(project(root), null), []);
    });
  }
);

testCovering(
  "a deletion of an edited copy is called out before it happens",
  "project-provisioning",
  ["Deletions are named by path"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      install(root);
      writeFileSync(
        resolve(skillsDir(root), packaged()[0], "SKILL.md"),
        "edited\n"
      );

      const edits = skillsComponent.plan(p, null);
      const edited = edits.find(
        (e) => e.kind === "path" && e.path.endsWith(packaged()[0])
      );

      assert.match(
        (edited as { note?: string }).note ?? "",
        /has local modifications/
      );
    });
  }
);

testCovering(
  "a skill installed elsewhere is named in the detail and not deleted by this row",
  "project-provisioning",
  ["A project-only component is not offered elsewhere"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      install(root);

      // A copy at a second destination, which this row reports but does not act
      // on: clearing the row deletes what is in the project, and nothing else.
      const elsewhere = resolve(root, "other-dest");
      mkdirSync(elsewhere, { recursive: true });
      cpSync(resolve(skillsDir(root), packaged()[0]), resolve(elsewhere, packaged()[0]), {
        recursive: true,
      });

      apply(p, skillsComponent.plan(p, null));

      assert.ok(existsSync(resolve(elsewhere, packaged()[0])));
    });
  }
);

testCovering(
  "applying a write creates the destination directory when it is missing",
  "skill-installation",
  ["Missing destination directory is created"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      assert.ok(!existsSync(skillsDir(root)));

      const said: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => void said.push(args.join(" "));
      try {
        apply(p, skillsComponent.plan(p, { dests: [projectDest(root)] }));
      } finally {
        console.log = originalLog;
      }

      assert.ok(existsSync(skillsDir(root)));
      assert.match(said.join("\n"), /created /);
      assert.match(said.join("\n"), /restarted/);
    });
  }
);

testCovering(
  "an edit this component does not own is ignored",
  "project-provisioning",
  ["Applying an unchanged selection is a no-op"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);

      // A region edit belongs to another component; this one leaves it alone.
      skillsComponent.applyEdit(p, {
        kind: "region",
        path: resolve(root, "CLAUDE.md"),
        before: null,
        after: "# Theirs\n",
      });

      assert.ok(!existsSync(resolve(root, "CLAUDE.md")));
    });
  }
);
