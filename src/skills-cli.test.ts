import { mock } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * The skill surface's own interactive paths: the bare invocation that shows
 * every skill at every destination as a selection, and the verbs invoked
 * without the names or the destination they need.
 *
 * The prompts are replaced rather than answered for real — a real prompt wants
 * a terminal, and a terminal means a subprocess, which the coverage
 * measurement does not follow. `process.stdin.isTTY` is set for the same
 * reason: the code refuses before asking when there is no terminal, and it is
 * the asking path that is under test here.
 */

const answers: {
  checkbox: unknown;
  confirm: unknown;
  asked: { message: string; choices?: unknown }[];
} = { checkbox: [], confirm: false, asked: [] };

const record = async (config: { message?: string; choices?: unknown }) => {
  answers.asked.push({ message: config?.message ?? "", choices: config?.choices });
  return answers.checkbox;
};

mock.module("@inquirer/prompts", {
  namedExports: {
    checkbox: record,
    confirm: async (config: { message?: string }) => {
      answers.asked.push({ message: config?.message ?? "" });
      return answers.confirm;
    },
    select: record,
    input: record,
  },
});

const { skillCommand } = await import("./skills-cli.js");
const { isExitError } = await import("./exit.js");
const { listPackagedSkills } = await import("./skill-source.js");
const { buildProgram } = await import("./program.js");

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
};

const packaged = (): string[] => listPackagedSkills().map((s) => s.name);

interface Ran {
  refused?: { message: string; code: number };
  said: string[];
}

/**
 * Runs a `skill` invocation from `root`, with a terminal, capturing what it
 * printed and the refusal it threw.
 */
async function run(argv: string[], root: string): Promise<Ran> {
  const previousCwd = process.cwd();
  const said: string[] = [];
  const originalLog = console.log;
  const originalTty = process.stdin.isTTY;

  console.log = (...args: unknown[]) => void said.push(args.join(" "));
  process.stdin.isTTY = true;
  process.chdir(root);

  try {
    // Attached to the program, so a refusal names "opsx-tools skill …".
    const program = buildProgram();
    const skill = program.commands.find((cmd) => cmd.name() === "skill");
    assert.ok(skill);
    skill.exitOverride();
    for (const verb of skill.commands) verb.exitOverride();

    await skill.parseAsync(argv, { from: "user" });
    return { said };
  } catch (err) {
    if (isExitError(err)) {
      return { refused: { message: err.message, code: err.code }, said };
    }
    throw err;
  } finally {
    process.chdir(previousCwd);
    console.log = originalLog;
    process.stdin.isTTY = originalTty;
    void skillCommand;
  }
}

function reset(): void {
  answers.checkbox = [];
  answers.confirm = false;
  answers.asked = [];
}

// =========================================================================
// The bare invocation
// =========================================================================

testCovering(
  "the bare invocation shows every skill at every destination, then asks",
  "skill-installation",
  ["State is shown before it is edited"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();

      const ran = await run([], root);

      assert.equal(ran.refused, undefined);
      const text = ran.said.join("\n");
      for (const name of packaged()) assert.ok(text.includes(name), name);
      // Both destinations, each as its own block.
      assert.match(text, /project \(/);
      assert.match(text, /^user\b/m);
      assert.match(answers.asked[0]?.message ?? "", /Check to install/);
    });
  }
);

testCovering(
  "a selection that changes nothing writes nothing and says so",
  "skill-installation",
  ["Unchanged selection does nothing"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.checkbox = [];

      const ran = await run([], root);

      assert.match(ran.said.join("\n"), /Nothing to change\./);
      assert.ok(!existsSync(resolve(root, ".claude/skills")));
    });
  }
);

testCovering(
  "the writes and deletions are named before the confirmation, and declining stops",
  "skill-installation",
  ["Edits are summarized before being applied"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.confirm = false;

      // Everything checked, nothing installed: all of it would be written.
      const ran = await run([], root);
      const chosen = (answers.asked[0].choices ?? []) as { value: unknown }[];
      reset();
      answers.checkbox = chosen.map((c) => c.value);
      answers.confirm = false;
      const declined = await run([], root);

      const text = declined.said.join("\n");
      assert.match(text, /Will be written:/);
      assert.ok(text.includes(resolve(root, ".claude/skills")));
      assert.match(text, /Nothing was written or deleted\./);
      assert.ok(!existsSync(resolve(root, ".claude/skills")));
      void ran;
    });
  }
);

testCovering(
  "confirming the selection installs what was checked and removes what was cleared",
  "skill-installation",
  ["Edits are summarized before being applied"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      await run([], root);
      const chosen = (answers.asked[0].choices ?? []) as { value: unknown }[];

      reset();
      answers.checkbox = chosen.map((c) => c.value);
      answers.confirm = true;
      await run([], root);

      for (const name of packaged()) {
        assert.ok(existsSync(resolve(root, ".claude/skills", name, "SKILL.md")));
      }

      // Now clear everything: the same call removes it again.
      reset();
      answers.checkbox = [];
      answers.confirm = true;
      const removed = await run([], root);

      assert.match(removed.said.join("\n"), /Will be deleted:/);
      for (const name of packaged()) {
        assert.ok(!existsSync(resolve(root, ".claude/skills", name)));
      }
    });
  }
);

testCovering(
  "a copy with local modifications is called out in the deletion list",
  "skill-installation",
  ["Removing a modified skill is called out"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      await run(["install", packaged()[0], "--project", "--yes"], root);
      writeFileSync(
        resolve(root, ".claude/skills", packaged()[0], "SKILL.md"),
        "edited\n"
      );

      reset();
      answers.checkbox = [];
      answers.confirm = false;
      const ran = await run([], root);

      assert.match(ran.said.join("\n"), /has local modifications/);
    });
  }
);

// =========================================================================
// The verbs, asked rather than told
// =========================================================================

testCovering(
  "installing without naming a skill asks which ones",
  "skill-installation",
  ["Destination is asked when not supplied"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.checkbox = [];

      const ran = await run(["install", "--project"], root);

      assert.match(answers.asked[0]?.message ?? "", /Which skills should be installed/);
      assert.match(ran.said.join("\n"), /Nothing selected\. Nothing was written\./);
    });
  }
);

testCovering(
  "removing without naming a skill asks, and selecting none deletes nothing",
  "skill-installation",
  ["Removal names its targets before deleting"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.checkbox = [];

      const ran = await run(["remove", "--project"], root);

      assert.match(answers.asked[0]?.message ?? "", /Which skills should be removed/);
      assert.match(ran.said.join("\n"), /Nothing selected\. Nothing was deleted\./);
    });
  }
);

testCovering(
  "a destination that was not supplied is asked for, with each path shown",
  "skill-installation",
  ["Both destinations offered"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.checkbox = [];

      await run(["install", packaged()[0]], root);

      const question = answers.asked[0];
      assert.match(question.message, /Where should the skills be installed/);
      const choices = question.choices as {
        name: string;
        value: { skillsDir: string };
      }[];
      for (const choice of choices) {
        assert.ok(choice.name.includes(choice.value.skillsDir));
      }
    });
  }
);

testCovering(
  "listing one named skill reports only that one",
  "skill-installation",
  ["State is reported per destination"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();

      const ran = await run(["list", packaged()[0], "--project"], root);

      const text = ran.said.join("\n");
      assert.ok(text.includes(packaged()[0]));
      assert.ok(!text.includes(packaged()[1]));
    });
  }
);

// =========================================================================
// A package that ships nothing
// =========================================================================

testCovering(
  "a package shipping no skills says so and ends successfully",
  "skill-installation",
  ["No packaged skills"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      // A directory with nothing in it, and one that is not there at all:
      // both report no packaged skills rather than failing.
      const empty = resolve(root, "empty-skills");
      mkdirSync(empty, { recursive: true });

      assert.deepEqual(listPackagedSkills(empty), []);
      assert.deepEqual(listPackagedSkills(resolve(root, "not-there")), []);

      // A directory holding something that is not a skill is not one either.
      const notASkill = resolve(root, "some-skills/no-manifest");
      mkdirSync(notASkill, { recursive: true });
      writeFileSync(resolve(notASkill, "README.md"), "not a skill\n");
      assert.deepEqual(listPackagedSkills(resolve(root, "some-skills")), []);
    });
  }
);

testCovering(
  "the user destination can be named on the command line",
  "skill-installation",
  ["Both destinations in one invocation"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();

      // Named rather than asked: the question is not put, and the destination
      // that was named is the one reported on.
      const ran = await run(["list", packaged()[0], "--user"], root);

      assert.deepEqual(answers.asked, []);
      assert.match(ran.said.join("\n"), /^user\b/m);
      assert.ok(!ran.said.join("\n").includes("project ("));
    });
  }
);
