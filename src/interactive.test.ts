import { mock } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { basename, resolve } from "path";
import { testCovering, withFiles } from "./test-fixture.js";
import type { ProjectIdentity } from "./types.js";

/**
 * The paths that ask a question.
 *
 * They cannot be reached in this process by answering for real: the prompts
 * want a terminal, and a terminal means a subprocess, which the coverage
 * measurement does not follow. The prompt module is replaced instead, so the
 * logic around the question — what is offered, what is pre-selected, what is
 * done with the answer — runs where it can be seen.
 *
 * The pty suite still drives the real prompts from outside. What it verifies is
 * that a terminal gets asked at all; what these verify is what happens with the
 * answer, which is the part with branches in it.
 */

/** What the next prompt of each kind will answer. Set per case. */
const answers: {
  checkbox: unknown;
  select: unknown;
  input: unknown;
  confirm: unknown;
  asked: { kind: string; message: string; choices?: unknown }[];
} = { checkbox: [], select: "", input: "", confirm: false, asked: [] };

function record(kind: string) {
  return async (config: { message?: string; choices?: unknown }) => {
    answers.asked.push({
      kind,
      message: config?.message ?? "",
      choices: config?.choices,
    });
    return answers[kind as "checkbox" | "select" | "input" | "confirm"];
  };
}

mock.module("@inquirer/prompts", {
  namedExports: {
    checkbox: record("checkbox"),
    select: record("select"),
    input: record("input"),
    confirm: record("confirm"),
  },
});

// Imported after the mock is installed, so the components bind to it.
const { artifactLanguageComponent } = await import(
  "./components/artifact-language.js"
);
const { claudeWorkflowComponent } = await import("./components/claude-workflow.js");
const { skillsComponent } = await import("./components/skills.js");

const project = (root: string): ProjectIdentity => ({
  root,
  name: basename(root),
  source: "openspec",
});

const CONFIG = "openspec/config.yaml";
const PROJECT: Record<string, string> = {
  [CONFIG]: "schema: spec-driven\n",
  "openspec/changes/.keep": "",
};

/** The context a component gets when nothing was supplied on the command line. */
const asking = {
  options: {} as Record<string, unknown>,
  requireInteractive: () => {},
};

function reset(): void {
  answers.checkbox = [];
  answers.select = "";
  answers.input = "";
  answers.confirm = false;
  answers.asked = [];
}

// =========================================================================
// artifact-language
// =========================================================================

testCovering(
  "the offered languages are presented, and the chosen one is what gets written",
  "artifact-language",
  ["A language outside the offered set is accepted"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.select = "es";

      const selection = await artifactLanguageComponent.choose(
        project(root),
        asking
      );

      assert.deepEqual(selection, { lang: "es" });
      const [question] = answers.asked;
      assert.match(question.message, /Which language/);
      // The offered set, and a way out of it.
      const values = (question.choices as { value: string }[]).map((c) => c.value);
      assert.deepEqual(values, ["pt-BR", "en", "es", "__other__"]);
    });
  }
);

testCovering(
  "naming a language outside the offered set is accepted",
  "artifact-language",
  ["A language outside the offered set is accepted"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.select = "__other__";
      answers.input = "  Norsk bokmål  ";

      const selection = await artifactLanguageComponent.choose(
        project(root),
        asking
      );

      // Trimmed, and carried through as the user typed it.
      assert.deepEqual(selection, { lang: "Norsk bokmål" });
      assert.equal(answers.asked.length, 2);
      assert.match(answers.asked[1].message, /Name the language/);
    });
  }
);

testCovering(
  "naming nothing at the free-text prompt selects nothing",
  "artifact-language",
  ["Absence is reported as absent"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.select = "__other__";
      answers.input = "   ";

      const selection = await artifactLanguageComponent.choose(
        project(root),
        asking
      );

      assert.equal(selection, null);
    });
  }
);

testCovering(
  "a language supplied on the command line is not asked about",
  "artifact-language",
  ["State names the configured language"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();

      const selection = await artifactLanguageComponent.choose(project(root), {
        ...asking,
        options: { lang: "pt-BR" },
      });

      assert.deepEqual(selection, { lang: "pt-BR" });
      assert.deepEqual(answers.asked, [], "nothing was asked");
    });
  }
);

// =========================================================================
// claude-workflow
// =========================================================================

testCovering(
  "the agreements are offered, all pre-checked when none is provisioned",
  "claude-workflow-directives",
  ["One agreement without the other"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.checkbox = ["todos"];

      const selection = await claudeWorkflowComponent.choose(
        project(root),
        asking
      );

      assert.deepEqual(selection, { keys: ["todos"] });
      const [question] = answers.asked;
      const choices = question.choices as { value: string; checked: boolean }[];
      assert.deepEqual(
        choices.map((c) => c.value),
        ["todos", "questions"]
      );
      // Nothing provisioned yet, so everything opens checked.
      assert.ok(choices.every((c) => c.checked));
    });
  }
);

testCovering(
  "the selection opens pre-checked to what the file already records",
  "claude-workflow-directives",
  ["State names the enabled agreements"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      // Provision one agreement, so the region records exactly that.
      for (const edit of claudeWorkflowComponent.plan(p, { keys: ["questions"] })) {
        claudeWorkflowComponent.applyEdit(p, edit);
      }

      reset();
      answers.checkbox = ["questions"];
      await claudeWorkflowComponent.choose(p, asking);

      const choices = answers.asked[0].choices as {
        value: string;
        checked: boolean;
      }[];
      assert.deepEqual(
        choices.filter((c) => c.checked).map((c) => c.value),
        ["questions"]
      );
    });
  }
);

testCovering(
  "selecting neither agreement is the same request as clearing the component",
  "claude-workflow-directives",
  ["Neither agreement removes the component"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.checkbox = [];

      const selection = await claudeWorkflowComponent.choose(
        project(root),
        asking
      );

      assert.equal(selection, null);
    });
  }
);

testCovering(
  "an agreement named on the command line is not asked about",
  "claude-workflow-directives",
  ["Both agreements together"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();

      const selection = await claudeWorkflowComponent.choose(project(root), {
        ...asking,
        options: { todos: true, questions: true },
      });

      assert.deepEqual(selection, { keys: ["todos", "questions"] });
      assert.deepEqual(answers.asked, []);
    });
  }
);

// =========================================================================
// skills
// =========================================================================

testCovering(
  "the skills component offers both destinations with their paths",
  "project-provisioning",
  ["A user-level destination is offered with its path"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.checkbox = [];

      await skillsComponent.choose(project(root), asking);

      const choices = answers.asked[0]?.choices as
        | { name: string; value: { id: string; skillsDir: string } }[]
        | undefined;
      assert.ok(choices, "a destination question was asked");
      assert.deepEqual(
        choices.map((c) => c.value.id),
        ["project", "user"]
      );
      // Each named with the absolute path that would be written.
      for (const choice of choices) {
        assert.ok(choice.name.includes(choice.value.skillsDir));
      }
    });
  }
);

testCovering(
  "a destination supplied on the command line skips the question",
  "project-provisioning",
  ["Supplied choices skip the prompts"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();

      const selection = await skillsComponent.choose(project(root), {
        ...asking,
        options: { project: true },
      });

      assert.deepEqual(answers.asked, []);
      assert.deepEqual(
        (selection as { dests: { id: string }[] } | null)?.dests.map((d) => d.id),
        ["project"]
      );
    });
  }
);

testCovering(
  "choosing no destination selects nothing",
  "project-provisioning",
  ["Declining exits zero"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      answers.checkbox = [];

      const selection = await skillsComponent.choose(project(root), asking);

      assert.equal(selection, null);
    });
  }
);

testCovering(
  "the chosen destination is what the skills are written to",
  "project-provisioning",
  ["Selecting skills provisions all of them"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const p = project(root);
      reset();

      const selection = await skillsComponent.choose(p, {
        ...asking,
        options: { project: true },
      });
      for (const edit of skillsComponent.plan(p, selection)) {
        skillsComponent.applyEdit(p, edit);
      }

      assert.ok(existsSync(resolve(root, ".claude/skills")));
      const installed = readFileSync(
        resolve(root, ".claude/skills/openspec-review-change/SKILL.md"),
        "utf8"
      );
      assert.ok(installed.length > 0);
    });
  }
);

testCovering(
  "the user destination can be chosen on its own, and both together",
  "project-provisioning",
  ["A user-level destination is offered with its path"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      const onlyUser = await skillsComponent.choose(project(root), {
        ...asking,
        options: { user: true },
      });
      assert.deepEqual(
        (onlyUser as { dests: { id: string }[] } | null)?.dests.map((d) => d.id),
        ["user"]
      );

      reset();
      const both = await skillsComponent.choose(project(root), {
        ...asking,
        options: { project: true, user: true },
      });
      assert.deepEqual(
        (both as { dests: { id: string }[] } | null)?.dests.map((d) => d.id),
        ["project", "user"]
      );
      assert.deepEqual(answers.asked, [], "neither was asked about");
    });
  }
);

testCovering(
  "a destination chosen at the prompt is what the selection carries",
  "project-provisioning",
  ["Supplied choices skip the prompts"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      reset();
      // Answer the destination question with the first offer.
      await skillsComponent.choose(project(root), asking);
      const offered = answers.asked[0].choices as { value: unknown }[];

      reset();
      answers.checkbox = [offered[0].value];
      const selection = await skillsComponent.choose(project(root), asking);

      assert.deepEqual(
        (selection as { dests: { id: string }[] } | null)?.dests.map((d) => d.id),
        ["project"]
      );
    });
  }
);
