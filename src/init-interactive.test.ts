import { mock } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * `init` invoked with no flags: the selection it presents, what it says about a
 * component it cannot offer, and what applying or declining does.
 *
 * The prompts are replaced, and `process.stdin.isTTY` is set, for the reason
 * the other interactive suites give: a real prompt wants a terminal, a terminal
 * means a subprocess, and the coverage measurement does not follow one.
 */

const answers: {
  checkbox: unknown[];
  confirm: boolean;
  asked: { message: string; choices?: unknown }[];
} = { checkbox: [], confirm: false, asked: [] };

mock.module("@inquirer/prompts", {
  namedExports: {
    checkbox: async (config: { message?: string; choices?: unknown }) => {
      answers.asked.push({
        message: config?.message ?? "",
        choices: config?.choices,
      });
      return answers.checkbox;
    },
    confirm: async (config: { message?: string }) => {
      answers.asked.push({ message: config?.message ?? "" });
      return answers.confirm;
    },
    select: async () => "",
    input: async () => "",
  },
});

const { buildProgram } = await import("./program.js");
const { isExitError } = await import("./exit.js");
const { COMPONENTS } = await import("./components/index.js");
const { skillState } = await import("./skill-state.js");

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
  "openspec/changes/.keep": "",
};

interface Ran {
  refused?: string;
  said: string[];
}

async function run(argv: string[], root: string): Promise<Ran> {
  const previousCwd = process.cwd();
  const said: string[] = [];
  const originalLog = console.log;
  const originalTty = process.stdin.isTTY;

  console.log = (...args: unknown[]) => void said.push(args.join(" "));
  process.stdin.isTTY = true;
  process.chdir(root);

  try {
    const program = buildProgram();
    const init = program.commands.find((cmd) => cmd.name() === "init");
    assert.ok(init);
    init.exitOverride();
    await init.parseAsync(argv, { from: "user" });
    return { said };
  } catch (err) {
    if (isExitError(err)) return { refused: err.message, said };
    throw err;
  } finally {
    process.chdir(previousCwd);
    console.log = originalLog;
    process.stdin.isTTY = originalTty;
  }
}

function reset(): void {
  answers.checkbox = [];
  answers.confirm = false;
  answers.asked = [];
}

// =========================================================================
// The selection
// =========================================================================

testCovering(
  "the selection presents every component with the state it has now",
  "project-provisioning",
  ["Every component is listed", "State is shown before any write"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();

      const ran = await run([], root);

      const text = ran.said.join("\n");
      for (const component of COMPONENTS) {
        assert.ok(text.includes(component.label), component.label);
      }
      assert.match(answers.asked[0]?.message ?? "", /Check to provision/);
      // Nothing provisioned, so nothing opens checked.
      const choices = answers.asked[0].choices as { checked: boolean }[];
      assert.ok(choices.every((c) => !c.checked));
      assert.match(text, /Nothing selected\. Nothing was written\./);
    });
  }
);

testCovering(
  "a component that cannot be offered explains why, and is not invented",
  "artifact-language",
  ["A missing configuration file is reported, not invented"],
  async () => {
    // An OpenSpec project with no configuration file at all.
    await withFiles({ "openspec/specs/.keep": "" }, async (root) => {
      reset();

      const ran = await run([], root);

      const text = ran.said.join("\n");
      assert.match(text, /The artifact language needs OpenSpec's config file/);
      assert.match(text, /no config\.yaml/);
      assert.match(text, /requires a schema value only you can choose/);
      assert.ok(!existsSync(resolve(root, "openspec/config.yaml")));
    });
  }
);

testCovering(
  "the selection opens pre-checked to what is already provisioned",
  "project-provisioning",
  ["A provisioned component is shown as provisioned"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      await run(["--commit-rule", "--yes"], root);

      reset();
      await run([], root);

      const choices = answers.asked[0].choices as {
        checked: boolean;
        value: { id: string };
      }[];
      assert.deepEqual(
        choices.filter((c) => c.checked).map((c) => c.value.id),
        ["commit-convention"]
      );
    });
  }
);

testCovering(
  "checking a component provisions it once the confirmation is given",
  "project-provisioning",
  ["Selecting an absent component provisions it"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      await run([], root);
      const choices = answers.asked[0].choices as {
        value: { id: string };
      }[];
      const commitRule = choices.find((c) => c.value.id === "commit-convention");
      assert.ok(commitRule);

      reset();
      answers.checkbox = [commitRule.value];
      answers.confirm = true;
      const ran = await run([], root);

      assert.ok(existsSync(resolve(root, ".claude/rules/commit-convention.md")));
      assert.match(ran.said.join("\n"), /Done\./);
    });
  }
);

testCovering(
  "clearing a provisioned component removes it once confirmed",
  "project-provisioning",
  ["Deselecting a provisioned component removes it"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      await run(["--commit-rule", "--yes"], root);
      assert.ok(existsSync(resolve(root, ".claude/rules/commit-convention.md")));

      reset();
      answers.checkbox = [];
      answers.confirm = true;
      await run([], root);

      assert.ok(!existsSync(resolve(root, ".claude/rules/commit-convention.md")));
    });
  }
);

testCovering(
  "declining the confirmation leaves the project untouched",
  "project-provisioning",
  ["Declining changes nothing"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      await run([], root);
      const choices = answers.asked[0].choices as { value: { id: string } }[];
      // The commit rule, which asks nothing of its own — the skills row would
      // ask for a destination, and that is a different path.
      const commitRule = choices.find((c) => c.value.id === "commit-convention");
      assert.ok(commitRule);

      reset();
      answers.checkbox = [commitRule.value];
      answers.confirm = false;
      const ran = await run([], root);

      assert.match(ran.said.join("\n"), /Nothing was written or deleted\./);
      assert.ok(!existsSync(resolve(root, ".claude/rules")));
    });
  }
);

// =========================================================================
// The states that are read from disk
// =========================================================================

testCovering(
  "an installed copy that cannot be read is reported as unreadable, not as differing",
  "skill-installation",
  ["Locally edited skill is distinguished"],
  async () => {
    await withFiles(
      { "packaged/demo/SKILL.md": "---\nname: demo\n---\n" },
      async (root) => {
        const dest = {
          id: "project" as const,
          label: "project (fixture)",
          skillsDir: resolve(root, "dest"),
        };
        mkdirSync(dest.skillsDir, { recursive: true });

        // A directory that is there and cannot be read: `stat` says directory,
        // and walking it throws. That is a different answer from "absent",
        // and from "differs".
        const installed = resolve(dest.skillsDir, "demo");
        mkdirSync(installed, { recursive: true });
        const { chmodSync } = await import("fs");
        chmodSync(installed, 0o000);

        try {
          const state = skillState(
            { name: "demo", path: resolve(root, "packaged/demo") },
            dest
          );

          assert.equal(state.kind, "unreadable");
          if (state.kind !== "unreadable") return;
          assert.ok(state.reason.length > 0);
        } finally {
          chmodSync(installed, 0o755);
        }
      }
    );
  }
);

testCovering(
  "a skills directory that is a broken symlink is not a directory",
  "skill-installation",
  ["Source is the package, not the working directory"],
  async () => {
    await withFiles({ "real/demo/SKILL.md": "---\nname: demo\n---\n" }, async (root) => {
      const { listPackagedSkills } = await import("./skill-source.js");

      // A dangling entry inside the packaged directory: `stat` throws on it,
      // so it is passed over rather than taken for a skill.
      symlinkSync(resolve(root, "nowhere"), resolve(root, "real/dangling"));
      writeFileSync(resolve(root, "real/loose.txt"), "not a directory\n");

      assert.deepEqual(
        listPackagedSkills(resolve(root, "real")).map((s) => s.name),
        ["demo"]
      );
    });
  }
);
