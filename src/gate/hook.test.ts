import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { REPO_ROOT } from "./scenarios.js";
import { testCovering, withFiles } from "../test-fixture.js";

/**
 * The gate's attachment to Git: that a commit runs it, that a refusal stops the
 * commit being made, and that the documented bypass really is one.
 *
 * The mechanism is exercised in a throwaway repository with a stand-in hook,
 * rather than by committing to this one - a test may not create commits here,
 * and what is being specified is how the hook is wired, not what it prints.
 * That this repository's own hook runs the gate is asserted on its text.
 */

const HOOK = join(REPO_ROOT, ".githooks", "pre-commit");

function git(cwd: string, ...args: string[]): { code: number; output: string } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
  return {
    code: result.status ?? -1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

/** A repository whose pre-commit hook exits with `code`, recording that it ran. */
function repoWithHook(root: string, code: number): void {
  git(root, "init", "-q");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");

  const hooks = join(root, ".githooks");
  mkdirSync(hooks, { recursive: true });
  const hook = join(hooks, "pre-commit");
  writeFileSync(
    hook,
    `#!/bin/sh\necho "gate ran" > "${join(root, "gate-ran")}"\nexit ${code}\n`
  );
  chmodSync(hook, 0o755);
  git(root, "config", "core.hooksPath", ".githooks");
}

testCovering(
  "the gate runs before a commit is created, and a refusal stops it",
  "quality-gates",
  ["Um commit passa pelo portão"],
  async () => {
    // A gate that passes: the commit is made, and the gate ran first.
    await withFiles({ "a.txt": "one\n" }, async (root) => {
      repoWithHook(root, 0);
      git(root, "add", "-A");

      const commit = git(root, "commit", "-m", "chore: one");

      assert.equal(commit.code, 0, commit.output);
      assert.equal(readFileSync(join(root, "gate-ran"), "utf8"), "gate ran\n");
      assert.match(git(root, "log", "--oneline").output, /chore: one/);
    });

    // A gate that refuses: no commit exists afterwards.
    await withFiles({ "a.txt": "one\n" }, async (root) => {
      repoWithHook(root, 1);
      git(root, "add", "-A");

      const commit = git(root, "commit", "-m", "chore: refused");

      assert.notEqual(commit.code, 0);
      assert.equal(readFileSync(join(root, "gate-ran"), "utf8"), "gate ran\n");
      // Nothing was created: there is no history at all.
      assert.notEqual(git(root, "log", "--oneline").code, 0);
    });
  }
);

testCovering(
  "the bypass works and the hook says in writing that it does",
  "quality-gates",
  ["Contornar é possível e está escrito"],
  async () => {
    const text = readFileSync(HOOK, "utf8");

    // Written down, as a deliberate choice rather than as a defect.
    assert.match(text, /--no-verify/);
    assert.match(text, /deliberately/);
    assert.ok(
      /honest|choice/.test(text),
      "the hook says why bypassing is allowed to exist"
    );

    // And it is real: a refusing gate is skipped by that option.
    await withFiles({ "a.txt": "one\n" }, async (root) => {
      repoWithHook(root, 1);
      git(root, "add", "-A");

      const commit = git(root, "commit", "--no-verify", "-m", "chore: bypassed");

      assert.equal(commit.code, 0, commit.output);
      assert.match(git(root, "log", "--oneline").output, /chore: bypassed/);
    });
  }
);

testCovering(
  "this repository's hook runs the gate, from its versioned hooks directory",
  "quality-gates",
  ["Um commit passa pelo portão"],
  () => {
    const text = readFileSync(HOOK, "utf8");

    assert.match(text, /npm run --silent gate/);
    // `set -e`, so the gate's exit code is the hook's.
    assert.match(text, /^set -e$/m);
    // Versioned here rather than in .git/hooks/, which Git does not track.
    assert.match(text, /core\.hooksPath \.githooks/);

    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    assert.match(pkg.scripts.prepare, /core\.hooksPath \.githooks/);
    assert.equal(pkg.scripts.gate, "tsx src/gate/run.ts");
  }
);
