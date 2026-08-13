import { mock } from "node:test";
import assert from "node:assert/strict";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * What every `skill` verb does when the package ships nothing to install.
 *
 * The source of packaged skills is replaced for this file alone: the real one
 * is derived from the package's own location, so the only way to see this
 * branch is to answer the question differently. It lives in its own file
 * because every other suite needs the real answer.
 */

mock.module("./skill-source.js", {
  namedExports: {
    listPackagedSkills: () => [],
    packagedSkillsDir: () => "/nowhere",
  },
});

const { buildProgram } = await import("./program.js");
const { isExitError } = await import("./exit.js");

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
};

async function run(argv: string[], root: string): Promise<{
  code?: number;
  message?: string;
}> {
  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    const program = buildProgram();
    const skill = program.commands.find((cmd) => cmd.name() === "skill");
    assert.ok(skill);
    skill.exitOverride();
    for (const verb of skill.commands) verb.exitOverride();

    await skill.parseAsync(argv, { from: "user" });
    return {};
  } catch (err) {
    if (isExitError(err)) return { code: err.code, message: err.message };
    throw err;
  } finally {
    process.chdir(previousCwd);
  }
}

testCovering(
  "a package shipping no skills says so, and it is not a failure",
  "skill-installation",
  ["No packaged skills"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      for (const argv of [
        ["install", "--project", "--yes"],
        ["remove", "--project", "--yes"],
        ["list"],
        [],
      ]) {
        const ran = await run(argv, root);

        assert.match(
          ran.message ?? "",
          /This package ships no skills to install/,
          argv.join(" ")
        );
        // Nothing to do is a complete answer, so the code is 0, not 1.
        assert.equal(ran.code, 0, argv.join(" "));
      }
    });
  }
);

testCovering(
  "with nothing packaged, the provisioning row reports the component as absent",
  "project-provisioning",
  ["Every component is listed"],
  async () => {
    const { skillsComponent } = await import("./components/skills.js");

    await withFiles(PROJECT, async (root) => {
      // No packaged skills at all: there is nothing to be installed, so the
      // row is absent rather than "0 of 0 installed".
      const state = skillsComponent.inspect({
        root,
        name: "fixture",
        source: "openspec",
      });

      assert.deepEqual(state, { kind: "absent" });
    });
  }
);
