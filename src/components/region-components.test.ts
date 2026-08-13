import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { basename, resolve } from "path";
import {
  artifactLanguageComponent,
  configPath,
  missingConfigReason,
} from "./artifact-language.js";
import { claudeMdPath, claudeWorkflowComponent } from "./claude-workflow.js";
import { commitConventionComponent, commitRulePath } from "./commit-convention.js";
import { renderPlan, type Edit, type RegionEdit } from "../component.js";
import { testCovering, withFiles } from "../test-fixture.js";
import type { ProjectIdentity } from "../types.js";

/**
 * The three components that edit a file the user owns, each over a throwaway
 * tree in the four states it has to tell apart: absent, provisioned, differing
 * from what the package writes, and not safely editable.
 *
 * Fixtures are written by each case rather than versioned, so a case states in
 * its own body which shape it is about - including shapes this repository does
 * not happen to contain.
 */

const project = (root: string): ProjectIdentity => ({
  root,
  name: basename(root),
  source: "openspec",
});

/** Applies a plan's region edits the way `applyPlan` would, and reads back. */
function apply(edits: Edit[], component: { applyEdit: (p: ProjectIdentity, e: Edit) => void }, p: ProjectIdentity): void {
  for (const edit of edits) component.applyEdit(p, edit);
}

const readOrNull = (path: string): string | null =>
  existsSync(path) ? readFileSync(path, "utf8") : null;

const CONFIG = "openspec/config.yaml";
const BARE_CONFIG = "schema: spec-driven\n";

// =========================================================================
// artifact-language
// =========================================================================

testCovering(
  "with no region in the configuration file, the language is reported as not set",
  "artifact-language",
  ["Absence is reported as absent"],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const state = artifactLanguageComponent.inspect(project(root));

      assert.deepEqual(state, { kind: "absent" });
    });
  }
);

testCovering(
  "the directive is written into the project's OpenSpec configuration file",
  "artifact-language",
  [
    "The directive is written to the project configuration",
    "The directive names the language",
    "The directive is scoped to artifacts",
  ],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);

      const edits = artifactLanguageComponent.plan(p, { lang: "pt-BR" });
      apply(edits, artifactLanguageComponent, p);

      const written = readFileSync(resolve(root, CONFIG), "utf8");
      // The context field, which is what OpenSpec injects into artifact
      // instructions - not a key of this package's own.
      assert.match(written, /^context: \|$/m);
      assert.match(written, /Português \(Brasil\)/);
      assert.match(written, /OpenSpec artifact/);
      // Scoped in its own text: it disclaims conversation, code and commits.
      assert.match(written, /does not set the language of/);
      assert.match(written, /conversation/);
      assert.match(written, /commit messages/);
      assert.ok(!written.includes("lang:"), "no key of its own is introduced");
    });
  }
);

testCovering(
  "a configuration file named config.yml is the one read and written",
  "artifact-language",
  ["Either configuration filename is recognized"],
  async () => {
    await withFiles({ "openspec/config.yml": BARE_CONFIG }, async (root) => {
      const p = project(root);

      assert.equal(configPath(p), resolve(root, "openspec/config.yml"));

      apply(
        artifactLanguageComponent.plan(p, { lang: "en" }),
        artifactLanguageComponent,
        p
      );

      assert.match(
        readFileSync(resolve(root, "openspec/config.yml"), "utf8"),
        /opsx-tools:artifact-language/
      );
      assert.ok(
        !existsSync(resolve(root, "openspec/config.yaml")),
        "no second configuration file is created alongside it"
      );
    });
  }
);

testCovering(
  "a project with openspec/ but no configuration file gets nothing invented for it",
  "artifact-language",
  ["A missing configuration file is reported, not invented"],
  async () => {
    await withFiles({ "openspec/specs/.keep": "" }, async (root) => {
      const p = project(root);

      assert.equal(configPath(p), null);
      assert.match(missingConfigReason(p) ?? "", /no config\.yaml/);
      assert.deepEqual(artifactLanguageComponent.plan(p, { lang: "en" }), []);
      assert.deepEqual(artifactLanguageComponent.inspect(p), { kind: "absent" });

      assert.ok(!existsSync(resolve(root, "openspec/config.yaml")));
      assert.ok(!existsSync(resolve(root, "openspec/config.yml")));
    });
  }
);

testCovering(
  "a language the package does not offer is accepted and named",
  "artifact-language",
  ["A language outside the offered set is accepted"],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);

      apply(
        artifactLanguageComponent.plan(p, { lang: "Deutsch" }),
        artifactLanguageComponent,
        p
      );

      const written = readFileSync(resolve(root, CONFIG), "utf8");
      assert.match(written, /Deutsch/);
      assert.deepEqual(artifactLanguageComponent.inspect(p), {
        kind: "provisioned",
        detail: "Deutsch",
      });
    });
  }
);

/**
 * A language whose name carries a space is written correctly - the directive
 * names it in full - but the delimiter records parameters as space-separated
 * `key=value` pairs, so reading the region back recovers only the first word
 * and the state comes out as "differs" rather than "provisioned".
 *
 * Recorded here rather than fixed: this change alters no production code, on
 * purpose. The case is pinned so the defect is visible and so the day someone
 * changes the payload encoding, this is what tells them what it was for.
 */
test("KNOWN DEFECT: a language name containing a space does not survive the delimiter", async () => {
  await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
    const p = project(root);

    apply(
      artifactLanguageComponent.plan(p, { lang: "Norsk bokmål" }),
      artifactLanguageComponent,
      p
    );

    // Written in full, and named in full, which is what the user reads.
    const written = readFileSync(resolve(root, CONFIG), "utf8");
    assert.match(written, /in Norsk bokmål\./);

    // But the state, read back out of the delimiter, has lost the second word.
    const state = artifactLanguageComponent.inspect(p);
    assert.equal(state.kind, "differs");
    assert.equal(state.kind === "differs" ? state.detail : "", "Norsk");
  });
});

testCovering(
  "the state is read back out of the file, and names the configured language",
  "artifact-language",
  ["State names the configured language", "No separate record is consulted"],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);
      apply(
        artifactLanguageComponent.plan(p, { lang: "es" }),
        artifactLanguageComponent,
        p
      );

      assert.deepEqual(artifactLanguageComponent.inspect(p), {
        kind: "provisioned",
        detail: "Español",
      });

      // Nothing but the file is consulted: a copy of it in a fresh tree, with
      // no history of a provisioning, reports the same state.
      const copied = readFileSync(resolve(root, CONFIG), "utf8");
      await withFiles({ [CONFIG]: copied }, async (elsewhere) => {
        assert.deepEqual(artifactLanguageComponent.inspect(project(elsewhere)), {
          kind: "provisioned",
          detail: "Español",
        });
      });
    });
  }
);

testCovering(
  "choosing a different language rewrites the directive rather than adding one",
  "artifact-language",
  ["A new language replaces the old one"],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);

      apply(
        artifactLanguageComponent.plan(p, { lang: "en" }),
        artifactLanguageComponent,
        p
      );
      apply(
        artifactLanguageComponent.plan(p, { lang: "pt-BR" }),
        artifactLanguageComponent,
        p
      );

      const written = readFileSync(resolve(root, CONFIG), "utf8");
      assert.match(written, /Português \(Brasil\)/);
      assert.ok(!written.includes("in English."));
      assert.equal(
        written.split("\n").filter((l) => l.includes("lang=")).length,
        1
      );
    });
  }
);

test("a hand-edited directive is reported as differing, not as provisioned", async () => {
  await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
    const p = project(root);
    apply(
      artifactLanguageComponent.plan(p, { lang: "en" }),
      artifactLanguageComponent,
      p
    );

    const path = resolve(root, CONFIG);
    const edited = readFileSync(path, "utf8").replace(
      /Write every OpenSpec artifact.*/,
      "Their own wording."
    );
    apply(
      [{ kind: "region", path, before: null, after: edited } as RegionEdit],
      artifactLanguageComponent,
      p
    );

    const state = artifactLanguageComponent.inspect(p);
    assert.equal(state.kind, "differs");
  });
});

test("a configuration file with damaged delimiters is reported unsafe and planned as nothing", async () => {
  const damaged = ["context: |", "  # opsx-tools:artifact-language", "  text", ""].join("\n");

  await withFiles({ [CONFIG]: damaged }, async (root) => {
    const p = project(root);

    const state = artifactLanguageComponent.inspect(p);
    assert.equal(state.kind, "unsafe");

    // Nothing is written: a plan never carries an edit it could not compute.
    assert.deepEqual(artifactLanguageComponent.plan(p, { lang: "en" }), []);
    assert.equal(readFileSync(resolve(root, CONFIG), "utf8"), damaged);
  });
});

testCovering(
  "applying the selection the project already has writes nothing",
  "project-provisioning",
  ["Applying an unchanged selection is a no-op"],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);
      apply(
        artifactLanguageComponent.plan(p, { lang: "en" }),
        artifactLanguageComponent,
        p
      );
      const after = readFileSync(resolve(root, CONFIG), "utf8");

      // Same selection again: no edit at all, so nothing to confirm and
      // nothing to write.
      assert.deepEqual(artifactLanguageComponent.plan(p, { lang: "en" }), []);
      assert.equal(readFileSync(resolve(root, CONFIG), "utf8"), after);
    });
  }
);

// =========================================================================
// claude-workflow
// =========================================================================

testCovering(
  "the agreements are written into CLAUDE.md at the resolved project root",
  "claude-workflow-directives",
  [
    "The directives are written to CLAUDE.md",
    "A missing CLAUDE.md is created",
    "The directive names its scope",
    "Unrelated work is not claimed",
  ],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);
      assert.ok(!existsSync(claudeMdPath(p)));

      apply(
        claudeWorkflowComponent.plan(p, { keys: ["todos", "questions"] }),
        claudeWorkflowComponent,
        p
      );

      const written = readFileSync(claudeMdPath(p), "utf8");
      assert.equal(claudeMdPath(p), resolve(root, "CLAUDE.md"));
      // Scoped in its own text to work under openspec/, and to nothing else.
      assert.match(written, /Working on OpenSpec files/);
      assert.match(written, /When the work touches files under `openspec\/`/);
      assert.ok(!/every file|all work|any change in this repository/i.test(written));
    });
  }
);

testCovering(
  "provisioning the agreements leaves the tool-agnostic files alone",
  "claude-workflow-directives",
  ["Tool-agnostic files are not written"],
  async () => {
    const agents = "# Agents\n\nTheir cross-tool notes.\n";

    await withFiles(
      { [CONFIG]: BARE_CONFIG, "AGENTS.md": agents },
      async (root) => {
        const p = project(root);

        apply(
          claudeWorkflowComponent.plan(p, { keys: ["todos"] }),
          claudeWorkflowComponent,
          p
        );

        assert.equal(readFileSync(resolve(root, "AGENTS.md"), "utf8"), agents);
        assert.equal(readFileSync(resolve(root, CONFIG), "utf8"), BARE_CONFIG);
      }
    );
  }
);

testCovering(
  "each agreement is switchable on its own, and the state names which are set",
  "claude-workflow-directives",
  [
    "One agreement without the other",
    "Both agreements together",
    "State names the enabled agreements",
  ],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);

      apply(
        claudeWorkflowComponent.plan(p, { keys: ["todos"] }),
        claudeWorkflowComponent,
        p
      );
      let written = readFileSync(claudeMdPath(p), "utf8");
      assert.match(written, /Track the work with the todo tool/);
      assert.ok(!written.includes("ask with the question tool"));
      assert.deepEqual(claudeWorkflowComponent.inspect(p), {
        kind: "provisioned",
        detail: "keep a task list",
      });

      apply(
        claudeWorkflowComponent.plan(p, { keys: ["todos", "questions"] }),
        claudeWorkflowComponent,
        p
      );
      written = readFileSync(claudeMdPath(p), "utf8");
      assert.match(written, /Track the work with the todo tool/);
      assert.match(written, /ask with the question tool/);
      assert.deepEqual(claudeWorkflowComponent.inspect(p), {
        kind: "provisioned",
        detail: "keep a task list, ask rather than assume",
      });
    });
  }
);

testCovering(
  "with no region in CLAUDE.md the agreements are reported as not set",
  "claude-workflow-directives",
  ["Absence is reported as absent"],
  async () => {
    await withFiles(
      { [CONFIG]: BARE_CONFIG, "CLAUDE.md": "# Theirs\n" },
      async (root) => {
        assert.deepEqual(claudeWorkflowComponent.inspect(project(root)), {
          kind: "absent",
        });
      }
    );
  }
);

test("a hand-edited region in CLAUDE.md is reported as differing", async () => {
  await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
    const p = project(root);
    apply(
      claudeWorkflowComponent.plan(p, { keys: ["todos"] }),
      claudeWorkflowComponent,
      p
    );

    const path = claudeMdPath(p);
    const edited = readFileSync(path, "utf8").replace(
      /- Track the work.*/,
      "- Their own rewording."
    );
    apply(
      [{ kind: "region", path, before: null, after: edited } as RegionEdit],
      claudeWorkflowComponent,
      p
    );

    const state = claudeWorkflowComponent.inspect(p);
    assert.equal(state.kind, "differs");
  });
});

test("a CLAUDE.md with damaged delimiters is unsafe and planned as nothing", async () => {
  const damaged = "# Theirs\n\n<!-- opsx-tools:claude-workflow -->\ntext\n";

  await withFiles(
    { [CONFIG]: BARE_CONFIG, "CLAUDE.md": damaged },
    async (root) => {
      const p = project(root);

      assert.equal(claudeWorkflowComponent.inspect(p).kind, "unsafe");
      assert.deepEqual(claudeWorkflowComponent.plan(p, { keys: ["todos"] }), []);
      assert.equal(readFileSync(claudeMdPath(p), "utf8"), damaged);
    }
  );
});

// =========================================================================
// commit-convention
// =========================================================================

testCovering(
  "the rule goes to the project's rules directory, and says what it must say",
  "commit-convention-rule",
  [
    "A regra vai para o diretório de regras do projeto",
    "Nenhum escopo por caminho é declarado",
    "O formato de uma linha é declarado",
    "O trailer de coautoria é nomeado como proibido",
  ],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);

      apply(
        commitConventionComponent.plan(p, {}),
        commitConventionComponent,
        p
      );

      assert.equal(
        commitRulePath(p),
        resolve(root, ".claude/rules/commit-convention.md")
      );
      const written = readFileSync(commitRulePath(p), "utf8");
      assert.match(written, /type\(scope\): description/);
      assert.match(written, /exactly one line/);
      assert.match(written, /no `Co-Authored-By` line/);
      // No frontmatter, so no path scoping: the rule loads every session,
      // which is when a commit message gets written.
      assert.ok(!written.startsWith("---"));
      assert.ok(!written.includes("paths:"));
    });
  }
);

testCovering(
  "a rule identical to the packaged one is reported as provisioned and rewrites nothing",
  "commit-convention-rule",
  ["Uma regra idêntica é relatada como provisionada"],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);
      apply(commitConventionComponent.plan(p, {}), commitConventionComponent, p);
      const written = readFileSync(commitRulePath(p), "utf8");

      const state = commitConventionComponent.inspect(p);
      assert.equal(state.kind, "provisioned");

      assert.deepEqual(commitConventionComponent.plan(p, {}), []);
      assert.equal(readFileSync(commitRulePath(p), "utf8"), written);
    });
  }
);

testCovering(
  "a hand-edited rule is reported as differing, and replacing it is shown as a diff",
  "commit-convention-rule",
  [
    "Uma regra editada à mão é relatada como diferente",
    "Substituir uma regra editada é mostrado como diff",
  ],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);
      apply(commitConventionComponent.plan(p, {}), commitConventionComponent, p);

      const path = commitRulePath(p);
      const edited = readFileSync(path, "utf8").replace(
        /- Keep the whole line at 72 characters or fewer\./,
        "- Keep the whole line at 100 characters or fewer."
      );
      apply(
        [{ kind: "region", path, before: null, after: edited } as RegionEdit],
        commitConventionComponent,
        p
      );

      assert.equal(commitConventionComponent.inspect(p).kind, "differs");

      // Provisioning over it produces an edit, and the plan shows both sides
      // of the changed hunk before any confirmation.
      const edits = commitConventionComponent.plan(p, {});
      assert.equal(edits.length, 1);
      const rendered = renderPlan(edits);
      assert.ok(rendered.some((l) => l.includes("- ") && l.includes("100 characters")));
      assert.ok(rendered.some((l) => l.includes("+ ") && l.includes("72 characters")));
    });
  }
);

testCovering(
  "text the user wrote in the rule file is preserved and the region stays apart",
  "commit-convention-rule",
  ["Texto do usuário no mesmo arquivo é preservado"],
  async () => {
    const theirs = "# Our own notes\n\nWe squash before merging.\n";

    await withFiles(
      { [CONFIG]: BARE_CONFIG, ".claude/rules/commit-convention.md": theirs },
      async (root) => {
        const p = project(root);

        apply(commitConventionComponent.plan(p, {}), commitConventionComponent, p);

        const written = readFileSync(commitRulePath(p), "utf8");
        assert.ok(written.startsWith(theirs), "byte for byte, as a prefix");
        assert.match(written, /opsx-tools:commit-convention/);
      }
    );
  }
);

testCovering(
  "other rule files in the directory are neither read nor written",
  "commit-convention-rule",
  ["Os outros arquivos de instrução não são tocados"],
  async () => {
    const other = "## Their other rule\n";

    await withFiles(
      {
        [CONFIG]: BARE_CONFIG,
        ".claude/rules/testing.md": other,
        "CLAUDE.md": "# Theirs\n",
        "AGENTS.md": "# Theirs\n",
      },
      async (root) => {
        const p = project(root);

        const edits = commitConventionComponent.plan(p, {});
        apply(edits, commitConventionComponent, p);

        assert.deepEqual(
          edits.map((e) => e.path),
          [commitRulePath(p)]
        );
        assert.equal(readFileSync(resolve(root, ".claude/rules/testing.md"), "utf8"), other);
        assert.equal(readFileSync(resolve(root, "CLAUDE.md"), "utf8"), "# Theirs\n");
        assert.equal(readFileSync(resolve(root, "AGENTS.md"), "utf8"), "# Theirs\n");
      }
    );
  }
);

test("a rule file with damaged delimiters is unsafe and planned as nothing", async () => {
  const damaged = "<!-- opsx-tools:commit-convention:end -->\ntext\n";

  await withFiles(
    { [CONFIG]: BARE_CONFIG, ".claude/rules/commit-convention.md": damaged },
    async (root) => {
      const p = project(root);

      assert.equal(commitConventionComponent.inspect(p).kind, "unsafe");
      assert.deepEqual(commitConventionComponent.plan(p, {}), []);
      assert.equal(readFileSync(commitRulePath(p), "utf8"), damaged);
    }
  );
});

// =========================================================================
// 4.3 - deselecting
// =========================================================================

testCovering(
  "deselecting a provisioned component removes what it wrote",
  "project-provisioning",
  ["Deselecting a provisioned component removes it", "Selecting an absent component provisions it"],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);

      // Absent to provisioned.
      assert.deepEqual(artifactLanguageComponent.inspect(p), { kind: "absent" });
      apply(
        artifactLanguageComponent.plan(p, { lang: "en" }),
        artifactLanguageComponent,
        p
      );
      assert.equal(artifactLanguageComponent.inspect(p).kind, "provisioned");

      // Provisioned back to absent, through the same call that provisions.
      apply(
        artifactLanguageComponent.plan(p, null),
        artifactLanguageComponent,
        p
      );
      assert.deepEqual(artifactLanguageComponent.inspect(p), { kind: "absent" });
      assert.equal(readFileSync(resolve(root, CONFIG), "utf8"), BARE_CONFIG);
    });
  }
);

testCovering(
  "a rule file the package created goes out whole when the component is deselected",
  "commit-convention-rule",
  ["Um arquivo criado pelo pacote sai inteiro", "Outras regras não são tocadas"],
  async () => {
    await withFiles(
      { [CONFIG]: BARE_CONFIG, ".claude/rules/testing.md": "## Theirs\n" },
      async (root) => {
        const p = project(root);
        apply(commitConventionComponent.plan(p, {}), commitConventionComponent, p);
        assert.ok(existsSync(commitRulePath(p)));

        apply(
          commitConventionComponent.plan(p, null),
          commitConventionComponent,
          p
        );

        assert.ok(!existsSync(commitRulePath(p)), "the file the package made is gone");
        // And nothing else in the directory, nor the directory itself.
        assert.ok(existsSync(resolve(root, ".claude/rules")));
        assert.equal(
          readFileSync(resolve(root, ".claude/rules/testing.md"), "utf8"),
          "## Theirs\n"
        );
      }
    );
  }
);

testCovering(
  "a rule file the user wrote is kept, with only the region taken out of it",
  "commit-convention-rule",
  ["Um arquivo do usuário é mantido"],
  async () => {
    const theirs = "# Our own notes\n\nWe squash before merging.\n";

    await withFiles(
      { [CONFIG]: BARE_CONFIG, ".claude/rules/commit-convention.md": theirs },
      async (root) => {
        const p = project(root);
        apply(commitConventionComponent.plan(p, {}), commitConventionComponent, p);

        apply(
          commitConventionComponent.plan(p, null),
          commitConventionComponent,
          p
        );

        assert.ok(existsSync(commitRulePath(p)));
        assert.equal(readFileSync(commitRulePath(p), "utf8"), theirs);
      }
    );
  }
);

testCovering(
  "a CLAUDE.md the package created is removed once nothing else remains in it",
  "claude-workflow-directives",
  ["An emptied file the package created is removed"],
  async () => {
    await withFiles({ [CONFIG]: BARE_CONFIG }, async (root) => {
      const p = project(root);
      apply(
        claudeWorkflowComponent.plan(p, { keys: ["todos"] }),
        claudeWorkflowComponent,
        p
      );
      assert.ok(existsSync(claudeMdPath(p)));

      apply(claudeWorkflowComponent.plan(p, null), claudeWorkflowComponent, p);

      assert.ok(!existsSync(claudeMdPath(p)));
    });
  }
);

testCovering(
  "a CLAUDE.md the user created is kept, even once it is empty",
  "claude-workflow-directives",
  ["An emptied file the user created is kept", "Removal leaves the rest of the file"],
  async () => {
    await withFiles(
      { [CONFIG]: BARE_CONFIG, "CLAUDE.md": "" },
      async (root) => {
        const p = project(root);
        apply(
          claudeWorkflowComponent.plan(p, { keys: ["todos"] }),
          claudeWorkflowComponent,
          p
        );

        apply(claudeWorkflowComponent.plan(p, null), claudeWorkflowComponent, p);

        assert.ok(existsSync(claudeMdPath(p)), "emptiness is not permission to delete");
        assert.equal(readOrNull(claudeMdPath(p)), "");
      }
    );
  }
);

testCovering(
  "selecting neither agreement leaves no directives and reports as not set",
  "claude-workflow-directives",
  ["Neither agreement removes the component"],
  async () => {
    await withFiles(
      { [CONFIG]: BARE_CONFIG, "CLAUDE.md": "# Theirs\n" },
      async (root) => {
        const p = project(root);

        // `choose` returns null for neither selected, which is the same
        // request as clearing the row.
        apply(claudeWorkflowComponent.plan(p, null), claudeWorkflowComponent, p);

        assert.deepEqual(claudeWorkflowComponent.inspect(p), { kind: "absent" });
        assert.equal(readFileSync(claudeMdPath(p), "utf8"), "# Theirs\n");
      }
    );
  }
);
