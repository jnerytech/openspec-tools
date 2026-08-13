import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, symlinkSync } from "fs";
import { resolve } from "path";
import { realpathSync } from "fs";
import { resolveProject } from "./project.js";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * The one place a path becomes an identity. Everything downstream - the derived
 * port, the display name, the skills destination - reads this single value, so
 * the same repository reached two ways must not become two projects.
 *
 * `realpathSync` on the fixture root: temporary directories are themselves
 * symlinked on some platforms, and the resolver normalizes what it is given.
 */

const real = (path: string): string => realpathSync(path);

testCovering(
  "a subdirectory resolves to the same root as the project itself",
  "server-startup",
  ["Subdirectory invocation reaches the same port"],
  async () => {
    await withFiles(
      { "openspec/specs/a/spec.md": "", "src/deep/nested/file.ts": "" },
      async (root) => {
        const fromRoot = resolveProject(root);
        const fromDeep = resolveProject(resolve(root, "src/deep/nested"));

        assert.equal(fromDeep.root, fromRoot.root);
        assert.equal(fromDeep.root, real(root));
        assert.equal(fromDeep.name, fromRoot.name);
      }
    );
  }
);

testCovering(
  "the same project reached through a symlink is the same project",
  "server-startup",
  ["Symlinked path is the same project"],
  async () => {
    await withFiles({ "openspec/specs/a/spec.md": "" }, async (root) => {
      const link = resolve(root, "..", `link-${process.pid}`);
      symlinkSync(root, link, "dir");

      try {
        assert.equal(resolveProject(link).root, resolveProject(root).root);
      } finally {
        const { rmSync } = await import("fs");
        rmSync(link, { force: true });
      }
    });
  }
);

testCovering(
  "a directory with no project markers still resolves, to itself",
  "server-startup",
  ["No project markers still resolves"],
  async () => {
    await withFiles({ "notes.md": "" }, async (root) => {
      // The fixture root is under a temporary directory, which has no
      // `openspec/` and no `.git` above it.
      const resolved = resolveProject(root);

      assert.equal(resolved.root, real(root));
      assert.equal(resolved.source, "cwd");
      assert.ok(resolved.name.length > 0);
    });
  }
);

testCovering(
  "an openspec/ owner wins over an enclosing repository root",
  "project-provisioning",
  ["The project is resolved the same way as for reading"],
  async () => {
    // A repository holding a docs project further in: the specs are what is
    // being read, so the `openspec/` owner is the project.
    await withFiles(
      { ".git/HEAD": "ref: refs/heads/main\n", "docs/openspec/specs/a/spec.md": "" },
      async (root) => {
        const resolved = resolveProject(resolve(root, "docs"));

        assert.equal(resolved.root, real(resolve(root, "docs")));
        assert.equal(resolved.source, "openspec");
      }
    );
  }
);

test("a repository root is used when nothing above holds openspec/", async () => {
  await withFiles(
    { ".git/HEAD": "ref: refs/heads/main\n", "src/a.ts": "" },
    async (root) => {
      const resolved = resolveProject(resolve(root, "src"));

      assert.equal(resolved.root, real(root));
      assert.equal(resolved.source, "git");
    }
  );
});

test("a .git file, as a linked worktree has, is a repository root too", async () => {
  await withFiles(
    { ".git": "gitdir: /elsewhere/.git/worktrees/w\n", "src/a.ts": "" },
    async (root) => {
      assert.equal(resolveProject(resolve(root, "src")).source, "git");
    }
  );
});

test("the display name is the root's basename", async () => {
  await withFiles({ "openspec/specs/a/spec.md": "" }, async (root) => {
    const resolved = resolveProject(root);

    assert.equal(resolved.name, real(root).split("/").pop());
  });
});

test("a trailing separator does not make a second project", async () => {
  await withFiles({ "openspec/specs/a/spec.md": "" }, async (root) => {
    assert.equal(resolveProject(`${root}/`).root, resolveProject(root).root);
  });
});

test("a path that does not exist still yields an identity", async () => {
  await withFiles({ "openspec/specs/a/spec.md": "" }, async (root) => {
    const missing = resolve(root, "not/created/yet");

    // Never resolved, so nothing is thrown: the absolute form is the identity.
    const resolved = resolveProject(missing);
    assert.equal(resolved.root, real(root));
  });
});

test("a nested openspec/ wins over one further up", async () => {
  await withFiles(
    { "openspec/specs/a/spec.md": "", "inner/openspec/specs/b/spec.md": "" },
    async (root) => {
      mkdirSync(resolve(root, "inner/src"), { recursive: true });

      assert.equal(
        resolveProject(resolve(root, "inner/src")).root,
        real(resolve(root, "inner"))
      );
    }
  );
});
