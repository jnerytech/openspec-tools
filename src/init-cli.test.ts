import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";
import { runCli, runCliInteractive } from "./gate/cli-runner.js";
import { COMPONENTS } from "./components/index.js";
import { listPackagedSkills } from "./skill-source.js";
import { resolveProject } from "./project.js";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * `opsx-tools init` as a process. The flag-driven paths run with input closed;
 * the few scenarios that are about *answering* a prompt - selecting nothing,
 * declining a confirmation - run through a pseudo-terminal, because a closed
 * input makes the command refuse before it ever asks, which is a different
 * behaviour from being asked and saying no.
 */

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
  "openspec/changes/.keep": "",
};

const RULE = ".claude/rules/commit-convention.md";

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

/** Strips the escape sequences a pty leaves in captured output. */
const plain = (text: string): string =>
  text.replace(/\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "");

// =========================================================================
// The precondition
// =========================================================================

testCovering(
  "a resolved root owning openspec/ is provisioned",
  "project-provisioning",
  ["An OpenSpec project is provisioned"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { code, output } = runCli(["init", "--commit-rule", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 0, output);
      assert.ok(existsSync(resolve(root, RULE)));
    });
  }
);

testCovering(
  "a git repository without openspec/ is refused, and nothing is created",
  "project-provisioning",
  ["A repository without OpenSpec is refused"],
  async () => {
    await withFiles(
      { ".git/HEAD": "ref: refs/heads/main\n", "README.md": "# Repo\n" },
      async (root) => {
        const before = treeOf(root);

        const { stderr, code } = runCli(["init", "--commit-rule", "--yes"], {
          cwd: root,
        });

        assert.equal(code, 1);
        assert.match(stderr, /No OpenSpec project here/);
        assert.match(stderr, /Run 'openspec init' to create one/);
        assert.deepEqual(treeOf(root), before);
        assert.ok(!existsSync(resolve(root, "openspec")));
      }
    );
  }
);

testCovering(
  "provisioning from a subdirectory resolves the same root as the reader",
  "project-provisioning",
  ["The project is resolved the same way as for reading"],
  async () => {
    await withFiles(
      { ...PROJECT, "src/deep/keep.txt": "x\n" },
      async (root) => {
        const deep = resolve(root, "src/deep");

        const { code, output } = runCli(["init", "--commit-rule", "--yes"], {
          cwd: deep,
        });

        assert.equal(code, 0, output);
        // Written at the project root the reader would derive its port from,
        // not beside the subdirectory the command was run in.
        assert.equal(resolveProject(deep).root, resolveProject(root).root);
        assert.ok(existsSync(resolve(root, RULE)));
        assert.ok(!existsSync(resolve(deep, RULE)));
      }
    );
  }
);

// =========================================================================
// The selection
// =========================================================================

testCovering(
  "the selection lists every component with its state, before anything is written",
  "project-provisioning",
  [
    "Every component is listed",
    "State is shown before any write",
    "Individual skills are not offered here",
  ],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      // Answering with a bare newline submits the checklist untouched, which
      // for an unprovisioned project selects nothing.
      const { code, output } = runCliInteractive(["init"], {
        cwd: root,
        answers: "\n",
      });
      const text = plain(output);

      assert.equal(code, 0);
      for (const component of COMPONENTS) {
        assert.ok(text.includes(component.label), `${component.label} is listed`);
        assert.ok(
          text.includes(`${component.label}  — not set`),
          `${component.label} carries its state`
        );
      }
      // The skills are one row, never one row per skill.
      const packaged = listPackagedSkills();
      assert.ok(packaged.length > 1);
      for (const skill of packaged) {
        assert.ok(!text.includes(skill.name), `${skill.name} is not its own item`);
      }
      assert.deepEqual(treeOf(root), before, "nothing written while choosing");
    });
  }
);

testCovering(
  "a component already provisioned is presented as provisioned",
  "project-provisioning",
  ["A provisioned component is shown as provisioned"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      runCli(["init", "--lang", "pt-BR", "--yes"], { cwd: root });

      const { output } = runCliInteractive(["init"], {
        cwd: root,
        answers: "\n",
      });
      const text = plain(output);

      // Named with what it is set to, not offered as something to add.
      assert.match(text, /Artifact language\s+Português \(Brasil\)/);
      assert.ok(!text.includes("Artifact language                not set"));
    });
  }
);

testCovering(
  "selecting nothing writes nothing and exits zero",
  "project-provisioning",
  ["Declining exits zero"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      const { code, output } = runCliInteractive(["init"], {
        cwd: root,
        answers: "\n",
      });

      assert.equal(code, 0);
      assert.match(plain(output), /Nothing selected\. Nothing was written\./);
      assert.deepEqual(treeOf(root), before);
    });
  }
);

testCovering(
  "declining the confirmation leaves the project untouched and says so",
  "project-provisioning",
  ["Declining changes nothing"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      // The component is named on the command line, so the only question left
      // is the confirmation itself - and it is answered no.
      const { code, output } = runCliInteractive(["init", "--commit-rule"], {
        cwd: root,
        answers: "n\n",
      });
      const text = plain(output);

      assert.equal(code, 0);
      assert.match(text, /Nothing was written or deleted\./);
      assert.deepEqual(treeOf(root), before);
      assert.ok(!existsSync(resolve(root, RULE)));
    });
  }
);

testCovering(
  "confirming an unchanged selection reports nothing to change and writes nothing",
  "project-provisioning",
  ["Applying an unchanged selection is a no-op"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      runCli(["init", "--commit-rule", "--yes"], { cwd: root });
      const after = treeOf(root);
      const contents = readFileSync(resolve(root, RULE), "utf8");

      // The checklist opens with what is provisioned already checked, so
      // submitting it untouched is the unchanged selection.
      const { code, output } = runCliInteractive(["init"], {
        cwd: root,
        answers: "\n",
      });

      assert.equal(code, 0);
      assert.match(plain(output), /Nothing to change\./);
      assert.deepEqual(treeOf(root), after);
      assert.equal(readFileSync(resolve(root, RULE), "utf8"), contents);
    });
  }
);

// =========================================================================
// The skills component
// =========================================================================

testCovering(
  "selecting the skills component provisions every packaged skill",
  "project-provisioning",
  ["Selecting skills provisions all of them"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { code, output } = runCli(
        ["init", "--skills", "--project", "--yes"],
        { cwd: root }
      );

      assert.equal(code, 0, output);
      for (const skill of listPackagedSkills()) {
        assert.ok(
          existsSync(resolve(root, ".claude/skills", skill.name, "SKILL.md")),
          `${skill.name} was installed`
        );
      }
    });
  }
);

testCovering(
  "the dedicated skill surface still selects individual skills",
  "project-provisioning",
  ["The dedicated skill surface is unaffected"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const one = listPackagedSkills()[0].name;

      const { code, output } = runCli(
        ["skill", "install", one, "--project", "--yes"],
        { cwd: root }
      );

      assert.equal(code, 0, output);
      assert.ok(existsSync(resolve(root, ".claude/skills", one, "SKILL.md")));
      // Exactly the one named, unlike the init component which takes all.
      assert.deepEqual(readdirSync(resolve(root, ".claude/skills")), [one]);
    });
  }
);

testCovering(
  "the user destination is offered with the absolute path it would write",
  "project-provisioning",
  ["A user-level destination is offered with its path"],
  () => {
    // Named in the help rather than probed by writing there: the destination
    // is outside any fixture, and a test may not write to a real home.
    const { stdout, code } = runCli(["init", "--help"]);

    assert.equal(code, 0);
    assert.match(stdout, /--user\s+skills go to ~\/\.claude\/skills\//);

    const { stdout: skillHelp } = runCli(["skill", "--help"]);
    assert.match(skillHelp, /--user\s+~\/\.claude\/skills\//);
  }
);

testCovering(
  "a project-only component offers no destination beyond the project",
  "project-provisioning",
  ["A project-only component is not offered elsewhere"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { stdout } = runCli(["init", "--help"]);

      // The destination options exist for the skills row alone; the region
      // components name no destination at all.
      assert.match(stdout, /--project\s+skills go to the project's/);
      assert.match(stdout, /--user\s+skills go to ~/);
      assert.ok(!/--user.*commit/i.test(stdout));
      assert.ok(!/--user.*language/i.test(stdout));

      // And provisioning one writes only under the project root.
      runCli(["init", "--commit-rule", "--lang", "en", "--todos", "--yes"], {
        cwd: root,
      });
      assert.ok(existsSync(resolve(root, RULE)));
      assert.ok(
        !existsSync(resolve(homedir(), ".claude/rules/commit-convention.md")),
        "nothing is written under the user's own rules directory"
      );
    });
  }
);

// =========================================================================
// Nothing depends on another program
// =========================================================================

testCovering(
  "provisioning runs no other program, with or without openspec on PATH",
  "project-provisioning",
  [
    "No third-party command is invoked",
    "A missing OpenSpec executable does not change the outcome",
  ],
  async () => {
    await withFiles(PROJECT, async (withPath) => {
      const first = runCli(["init", "--commit-rule", "--yes"], {
        cwd: withPath,
      });

      await withFiles(PROJECT, async (withoutPath) => {
        // An empty PATH: no `openspec` executable is reachable at all.
        const second = runCli(["init", "--commit-rule", "--yes"], {
          cwd: withoutPath,
          env: { PATH: "" },
        });

        assert.equal(first.code, 0, first.output);
        assert.equal(second.code, second.code, second.output);
        assert.equal(second.code, 0, second.output);
        // Identical outcome: same file, same bytes.
        assert.equal(
          readFileSync(resolve(withoutPath, RULE), "utf8"),
          readFileSync(resolve(withPath, RULE), "utf8")
        );
      });
    });
  }
);

testCovering(
  "a useful follow-up OpenSpec command is printed, never executed",
  "project-provisioning",
  ["Refreshing OpenSpec is reported, not performed"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { code, stdout } = runCli(
        ["init", "--skills", "--project", "--yes"],
        // An empty PATH proves it: had the command been run, it would have
        // failed to be found, and provisioning still exits zero.
        { cwd: root, env: { PATH: "" } }
      );

      assert.equal(code, 0);
      assert.match(stdout, /Next: run 'openspec update'/);
      // Printed as a suggestion, not as something that happened.
      assert.ok(!/running openspec|openspec update\.\.\./i.test(stdout));
    });
  }
);

testCovering(
  "a write that cannot be completed names the path and fails",
  "project-provisioning",
  ["A failed write is reported and fails"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      // A file where the rules directory has to go: creating the directory
      // cannot succeed, so the write named in the plan cannot be completed.
      writeFileSync(resolve(root, ".claude"), "not a directory\n");

      const { stderr, code } = runCli(["init", "--commit-rule", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 1);
      assert.match(stderr, /Could not complete the change to/);
      assert.ok(stderr.includes(resolve(root, RULE)), stderr);
    });
  }
);

// =========================================================================
// commit-convention-rule: the non-interactive surface
// =========================================================================

testCovering(
  "a missing rules directory is created, and the restart caveat is reported",
  "commit-convention-rule",
  ["Um diretório de regras ausente é criado e a criação é relatada"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      assert.ok(!existsSync(resolve(root, ".claude/rules")));

      const { code, stdout } = runCli(["init", "--commit-rule", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 0);
      assert.ok(existsSync(resolve(root, ".claude/rules")));
      assert.ok(stdout.includes(`created ${resolve(root, ".claude/rules")}`), stdout);
      assert.match(stdout, /only detected after the tool is restarted/);
    });
  }
);

testCovering(
  "provisioning and removing the rule each have an option, and neither asks",
  "commit-convention-rule",
  ["Provisionar sem prompt", "Remover sem prompt"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const provisioned = runCli(["init", "--commit-rule", "--yes"], {
        cwd: root,
      });
      assert.equal(provisioned.code, 0, provisioned.output);
      assert.ok(existsSync(resolve(root, RULE)));
      assert.ok(!/must be supplied when input is not a terminal/.test(provisioned.output));

      const removed = runCli(["init", "--no-commit-rule", "--yes"], {
        cwd: root,
      });
      assert.equal(removed.code, 0, removed.output);
      assert.ok(!existsSync(resolve(root, RULE)));
      assert.ok(!/must be supplied when input is not a terminal/.test(removed.output));
    });
  }
);

testCovering(
  "a component the command line does not name is left exactly as it is",
  "commit-convention-rule",
  ["Um componente não nomeado é deixado como está"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      runCli(["init", "--commit-rule", "--yes"], { cwd: root });
      const before = readFileSync(resolve(root, RULE), "utf8");

      // Another component named, this one not.
      const { code } = runCli(["init", "--lang", "en", "--yes"], { cwd: root });

      assert.equal(code, 0);
      assert.equal(readFileSync(resolve(root, RULE), "utf8"), before);

      // And the same when the named component is being removed.
      runCli(["init", "--no-lang", "--yes"], { cwd: root });
      assert.equal(readFileSync(resolve(root, RULE), "utf8"), before);
    });
  }
);

testCovering(
  "provisioning the rule installs no hook and runs no other program",
  "commit-convention-rule",
  ["Nada além do arquivo é provisionado"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      // An empty PATH: nothing external could have been run and succeeded.
      const { code } = runCli(["init", "--commit-rule", "--yes"], {
        cwd: root,
        env: { PATH: "" },
      });

      assert.equal(code, 0);
      const written = treeOf(root).filter((p) => !before.includes(p));
      assert.deepEqual(written, [RULE], "exactly one file, and it is the rule");
      // No Git hook, no Claude Code hook configuration.
      assert.ok(!existsSync(resolve(root, ".git/hooks/commit-msg")));
      assert.ok(!existsSync(resolve(root, ".githooks")));
      assert.ok(!existsSync(resolve(root, ".claude/settings.json")));
      assert.ok(!existsSync(resolve(root, ".claude/hooks")));
    });
  }
);

testCovering(
  "the rule is described as an instruction, never as an enforced restriction",
  "commit-convention-rule",
  ["O relato não promete obediência"],
  () => {
    const { stdout } = runCli(["init", "--help"]);

    // The component's own summary calls it an instruction.
    assert.match(stdout, /an instruction, not a check/);
    // And the command says out loud that nothing here enforces anything.
    assert.match(stdout, /They are not enforced/);
    assert.match(stdout, /nothing here installs a Git hook/);
  }
);

testCovering(
  "the rule offers no destination outside the project",
  "commit-convention-rule",
  ["Nenhum destino de usuário é oferecido"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { stdout } = runCli(["init", "--help"]);

      // The only destination options belong to the skills row.
      assert.match(stdout, /--project\s+skills go to/);
      assert.ok(!/--user.*commit-rule/i.test(stdout));

      runCli(["init", "--commit-rule", "--user", "--yes"], { cwd: root });

      assert.ok(existsSync(resolve(root, RULE)));
      assert.ok(
        !existsSync(resolve(homedir(), ".claude/rules/commit-convention.md")),
        "naming --user writes nothing under the user's rules directory"
      );
    });
  }
);

testCovering(
  "damaged delimiters stop the edit, change nothing, and exit one",
  "commit-convention-rule",
  ["Delimitadores danificados impedem a escrita"],
  async () => {
    const damaged = "<!-- opsx-tools:commit-convention -->\nhalf a region\n";

    await withFiles({ ...PROJECT, [RULE]: damaged }, async (root) => {
      const { stderr, code } = runCli(["init", "--commit-rule", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 1);
      assert.match(stderr, /cannot be provisioned/);
      assert.match(stderr, /Nothing was written/);
      assert.equal(readFileSync(resolve(root, RULE), "utf8"), damaged);
    });
  }
);

// =========================================================================
// artifact-language and claude-workflow: the same three shapes
// =========================================================================

testCovering(
  "a damaged configuration file stops the language edit and exits one",
  "artifact-language",
  ["Damaged delimiters stop the edit"],
  async () => {
    const damaged = [
      "schema: spec-driven",
      "context: |",
      "  # opsx-tools:artifact-language lang=en",
      "  half a region",
      "",
    ].join("\n");

    await withFiles({ "openspec/config.yaml": damaged }, async (root) => {
      const { stderr, code } = runCli(["init", "--lang", "pt-BR", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 1);
      assert.match(stderr, /cannot be provisioned/);
      assert.match(stderr, /Nothing was written/);
      assert.equal(
        readFileSync(resolve(root, "openspec/config.yaml"), "utf8"),
        damaged
      );
    });
  }
);

testCovering(
  "a damaged CLAUDE.md stops the working-agreements edit and exits one",
  "claude-workflow-directives",
  ["Damaged delimiters stop the edit"],
  async () => {
    const damaged = "# Theirs\n\n<!-- opsx-tools:claude-workflow:end -->\n";

    await withFiles({ ...PROJECT, "CLAUDE.md": damaged }, async (root) => {
      const { stderr, code } = runCli(["init", "--todos", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 1);
      assert.match(stderr, /cannot be provisioned/);
      assert.match(stderr, /Nothing was written/);
      assert.equal(readFileSync(resolve(root, "CLAUDE.md"), "utf8"), damaged);
    });
  }
);

testCovering(
  "an edited language region is reported as differing and the change is shown",
  "artifact-language",
  ["An edited region is reported and confirmed"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      runCli(["init", "--lang", "en", "--yes"], { cwd: root });
      const config = resolve(root, "openspec/config.yaml");
      writeFileSync(
        config,
        readFileSync(config, "utf8").replace(
          /Write every OpenSpec artifact.*/,
          "Their own wording."
        )
      );

      // Asked, through a terminal, and the difference is shown before it.
      const { output } = runCliInteractive(["init", "--lang", "en"], {
        cwd: root,
        answers: "n\n",
      });
      const text = plain(output);

      assert.match(text, /Artifact language differs from what this package writes/);
      assert.ok(text.includes("-   Their own wording."), text);
      assert.ok(text.includes("+   Write every OpenSpec artifact"), text);
      assert.match(text, /Apply these changes\?/);
    });
  }
);

testCovering(
  "declining leaves an edited language region exactly as the user left it",
  "artifact-language",
  ["Declining leaves the edited region alone"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      runCli(["init", "--lang", "en", "--yes"], { cwd: root });
      const config = resolve(root, "openspec/config.yaml");
      const edited = readFileSync(config, "utf8").replace(
        /Write every OpenSpec artifact.*/,
        "Their own wording."
      );
      writeFileSync(config, edited);

      const { code, output } = runCliInteractive(["init", "--lang", "en"], {
        cwd: root,
        answers: "n\n",
      });

      assert.equal(code, 0);
      assert.match(plain(output), /Nothing was written or deleted\./);
      assert.equal(readFileSync(config, "utf8"), edited);
    });
  }
);

testCovering(
  "an edited CLAUDE.md region is reported, and declining leaves it alone",
  "claude-workflow-directives",
  ["An edited region is reported and confirmed", "Declining leaves the edited region alone"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      runCli(["init", "--todos", "--yes"], { cwd: root });
      const claudeMd = resolve(root, "CLAUDE.md");
      const edited = readFileSync(claudeMd, "utf8").replace(
        /- Track the work.*/,
        "- Their own rewording."
      );
      writeFileSync(claudeMd, edited);

      const { code, output } = runCliInteractive(["init", "--todos"], {
        cwd: root,
        answers: "n\n",
      });
      const text = plain(output);

      assert.equal(code, 0);
      assert.match(
        text,
        /Claude Code working agreements differs from what this package writes/
      );
      assert.ok(text.includes("- - Their own rewording."), text);
      assert.match(text, /Apply these changes\?/);
      assert.equal(readFileSync(claudeMd, "utf8"), edited);
    });
  }
);

testCovering(
  "what was written is reported, and the help promises no enforcement",
  "claude-workflow-directives",
  ["Reporting describes what was written", "Help text does not promise enforcement"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const { code, stdout } = runCli(["init", "--todos", "--questions", "--yes"], {
        cwd: root,
      });

      assert.equal(code, 0);
      // The path, and the lines that went into it.
      assert.ok(stdout.includes(resolve(root, "CLAUDE.md")), stdout);
      assert.ok(stdout.includes("+ ## Working on OpenSpec files"), stdout);
      assert.ok(stdout.includes("+ - Track the work with the todo tool"), stdout);
      assert.ok(stdout.includes("+ - When a decision is ambiguous"), stdout);
      assert.match(stdout, /Done\./);

      const help = runCli(["init", "--help"]).stdout;
      assert.match(help, /directives for how Claude Code works on files under openspec\//);
      assert.match(help, /instructions written for the\s+agent to read/);
      assert.match(help, /They are not enforced/);
      assert.ok(!/enforce[sd]\b(?! )/.test(help.replace(/not enforced/g, "")));
    });
  }
);

test("the working agreements are written where Claude Code reads them, and nowhere else", async () => {
  await withFiles(
    { ...PROJECT, "AGENTS.md": "# Theirs\n" },
    async (root) => {
      runCli(["init", "--todos", "--yes"], { cwd: root });

      assert.ok(existsSync(resolve(root, "CLAUDE.md")));
      assert.equal(readFileSync(resolve(root, "AGENTS.md"), "utf8"), "# Theirs\n");
      assert.equal(
        readFileSync(resolve(root, "openspec/config.yaml"), "utf8"),
        "schema: spec-driven\n"
      );
    }
  );
});
