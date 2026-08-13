import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveOutOfScope, type OutOfScopeEntry } from "./out-of-scope.js";
import { OUT_OF_SCOPE } from "./out-of-scope.js";
import { readSpecScenarios, scenarioKey } from "./scenarios.js";
import {
  readDeclared,
  readRecord,
  report,
  verify,
  writeRecord,
  type CoverageRecord,
} from "./verify.js";
import { testCovering } from "../test-fixture.js";

/**
 * The gate checking itself. Written before `quality-gates` was canonical and
 * declared the moment archiving promoted it into `openspec/specs/` - which is
 * the flow the proposal describes, seen from the inside.
 */

/** A throwaway `openspec/specs/` tree, so no case depends on the real one. */
function withSpecs<T>(
  capabilities: Record<string, string[]>,
  fn: (specsDir: string) => T
): T {
  const root = mkdtempSync(join(tmpdir(), "opsx-gate-test-"));
  try {
    for (const [capability, titles] of Object.entries(capabilities)) {
      const dir = join(root, capability);
      mkdirSync(dir, { recursive: true });
      const body = titles
        .map((title) => `#### Scenario: ${title}\n\n- **WHEN** x\n- **THEN** y\n`)
        .join("\n");
      writeFileSync(join(dir, "spec.md"), `# ${capability}\n\n${body}`, "utf8");
    }
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const declaredSet = (...pairs: [string, string][]): Set<string> =>
  new Set(pairs.map(([capability, title]) => scenarioKey(capability, title)));

const SPECS = { alpha: ["First thing", "Second thing"], beta: ["Third thing"] };

// =========================================================================
// Reading the specs
// =========================================================================

testCovering(
  "a change still in planning is not charged for the scenarios it declares",
  "quality-gates",
  ["Uma change em planejamento não é cobrada"],
  () => {
    const root = mkdtempSync(join(tmpdir(), "opsx-gate-planning-"));
    try {
      // A canonical capability, and a change in planning declaring another.
      mkdirSync(join(root, "specs", "alpha"), { recursive: true });
      writeFileSync(
        join(root, "specs/alpha/spec.md"),
        "#### Scenario: First thing\n"
      );
      mkdirSync(join(root, "changes/some-change/specs/planned"), {
        recursive: true,
      });
      writeFileSync(
        join(root, "changes/some-change/specs/planned/spec.md"),
        "#### Scenario: Not canonical yet\n"
      );

      const specs = readSpecScenarios(join(root, "specs"));

      assert.deepEqual([...specs.keys()], ["alpha"]);
      assert.ok(!specs.has("planned"));

      // And with nothing covered, only the canonical one is demanded.
      const verdict = verify({
        declared: new Set(),
        specsDir: join(root, "specs"),
        outOfScope: [],
      });
      assert.deepEqual(verdict.undeclared, [
        { capability: "alpha", title: "First thing" },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
);

testCovering(
  "archiving promotes a change's scenarios into the denominator",
  "quality-gates",
  ["Arquivar promove os scenarios ao denominador"],
  () => {
    const specs = readSpecScenarios();

    // This very capability: declared under openspec/changes/ while the change
    // was open, and demanded like any other from the moment it was archived.
    assert.ok(specs.has("quality-gates"));
    assert.ok(
      (specs.get("quality-gates") ?? []).includes(
        "Arquivar promove os scenarios ao denominador"
      )
    );

    // Demanded means demanded: uncovered, it would refuse.
    const verdict = verify({ declared: new Set(), outOfScope: [] });
    assert.ok(
      verdict.undeclared.some((r) => r.capability === "quality-gates"),
      "quality-gates scenarios are in the denominator"
    );
  }
);

testCovering(
  "the decision is taken over scenarios, and no line percentage enters it",
  "quality-gates",
  ["Um scenario descoberto recusa mesmo com cobertura total de código"],
  () => {
    withSpecs(SPECS, (specsDir) => {
      // The verifier is given the declared scenarios and nothing else: there
      // is no line-coverage input for a floor to be applied to.
      const verdict = verify({
        declared: declaredSet(
          ["alpha", "First thing"],
          ["alpha", "Second thing"],
          ["beta", "Third thing"]
        ),
        specsDir,
        outOfScope: [],
      });

      assert.equal(verdict.ok, true);
      assert.deepEqual(Object.keys(verdict).sort(), [
        "coveredCount",
        "ok",
        "outOfScopeCount",
        "regressed",
        "rejected",
        "specifiedCount",
        "undeclared",
      ]);
      // Nothing in the verdict is a percentage of lines.
      assert.equal(verdict.coveredCount, 3);
      assert.equal(verdict.specifiedCount, 3);
    });
  }
);

// =========================================================================
// Neither covered nor declared
// =========================================================================

testCovering(
  "a scenario with no test and no declaration makes the gate refuse",
  "quality-gates",
  ["Um scenario nem coberto nem declarado faz recusar"],
  () => {
  withSpecs(SPECS, (specsDir) => {
    const verdict = verify({
      declared: declaredSet(["alpha", "First thing"]),
      specsDir,
      outOfScope: [],
    });

    assert.equal(verdict.ok, false);
    assert.deepEqual(verdict.undeclared, [
      { capability: "alpha", title: "Second thing" },
      { capability: "beta", title: "Third thing" },
    ]);
  });
});

testCovering(
  "a scenario declared out of scope with a reason does not make it refuse",
  "quality-gates",
  ["Um scenario declarado fora de alcance não faz recusar"],
  () => {
  withSpecs(SPECS, (specsDir) => {
    const verdict = verify({
      declared: declaredSet(["alpha", "First thing"], ["alpha", "Second thing"]),
      specsDir,
      outOfScope: [
        { capability: "beta", title: "Third thing", reason: "it is a prompt" },
      ],
    });

    assert.equal(verdict.ok, true);
    assert.deepEqual(verdict.undeclared, []);
    assert.equal(verdict.outOfScopeCount, 1);
  });
});

test("a whole capability can be declared out of scope at once", () => {
  withSpecs(SPECS, (specsDir) => {
    const verdict = verify({
      declared: declaredSet(["beta", "Third thing"]),
      specsDir,
      outOfScope: [{ capability: "alpha", title: "*", reason: "a prompt" }],
    });

    assert.equal(verdict.ok, true);
    assert.equal(verdict.outOfScopeCount, 2);
  });
});

// =========================================================================
// A declaration without a reason
// =========================================================================

testCovering(
  "an out-of-scope entry with no reason is treated as absent",
  "quality-gates",
  ["Uma declaração sem razão não vale"],
  () => {
  withSpecs(SPECS, (specsDir) => {
    const verdict = verify({
      declared: declaredSet(["alpha", "First thing"], ["alpha", "Second thing"]),
      specsDir,
      outOfScope: [{ capability: "beta", title: "Third thing", reason: "  " }],
    });

    assert.equal(verdict.ok, false);
    // Back to being simply uncovered, which is the point of requiring one.
    assert.deepEqual(verdict.undeclared, [
      { capability: "beta", title: "Third thing" },
    ]);
    assert.equal(verdict.outOfScopeCount, 0);
    assert.equal(verdict.rejected.length, 1);
    assert.match(verdict.rejected[0].problem, /no reason given/);
  });
});

test("an out-of-scope entry naming a scenario that no longer exists is rejected", () => {
  withSpecs(SPECS, (specsDir) => {
    const { declared, rejected } = resolveOutOfScope(
      [{ capability: "alpha", title: "Renamed away", reason: "a prompt" }],
      specsDir
    );

    assert.equal(declared.size, 0);
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].problem, /declares no scenario/);
  });
});

test("an out-of-scope entry naming a capability that does not exist is rejected", () => {
  withSpecs(SPECS, (specsDir) => {
    const { rejected } = resolveOutOfScope(
      [{ capability: "gamma", title: "*", reason: "a prompt" }],
      specsDir
    );

    assert.equal(rejected.length, 1);
    assert.match(rejected[0].problem, /no capability "gamma"/);
  });
});

test("this repository's own out-of-scope list resolves cleanly and carries reasons", () => {
  const { rejected } = resolveOutOfScope();

  assert.deepEqual(rejected, []);
  for (const entry of OUT_OF_SCOPE) {
    assert.ok(entry.reason.trim().length > 40, `${entry.capability} states why`);
  }
});

// =========================================================================
// Regression, by set rather than by count
// =========================================================================

const RECORD: CoverageRecord = {
  covered: { alpha: ["First thing", "Second thing"], beta: ["Third thing"] },
};

testCovering(
  "losing the cover of a recorded scenario makes the gate refuse, naming it",
  "quality-gates",
  ["Perder a cobertura de um scenario faz recusar"],
  () => {
  withSpecs(SPECS, (specsDir) => {
    const verdict = verify({
      declared: declaredSet(["alpha", "First thing"], ["beta", "Third thing"]),
      specsDir,
      record: RECORD,
      outOfScope: [{ capability: "alpha", title: "Second thing", reason: "n/a" }],
    });

    assert.equal(verdict.ok, false);
    assert.deepEqual(verdict.regressed, [
      { capability: "alpha", title: "Second thing" },
    ]);
  });
});

testCovering(
  "covering something new does not pay for losing something old",
  "quality-gates",
  ["Cobrir outro scenario não compensa a perda"],
  () => {
  withSpecs({ alpha: ["First thing", "Second thing", "New thing"] }, (specsDir) => {
    // One lost, one gained: the count is unchanged, and the set is not.
    const verdict = verify({
      declared: declaredSet(["alpha", "First thing"], ["alpha", "New thing"]),
      specsDir,
      record: { covered: { alpha: ["First thing", "Second thing"] } },
      outOfScope: [{ capability: "alpha", title: "Second thing", reason: "n/a" }],
    });

    assert.equal(verdict.ok, false);
    assert.deepEqual(verdict.regressed, [
      { capability: "alpha", title: "Second thing" },
    ]);
  });
});

testCovering(
  "a scenario that has left the specs is not a regression",
  "quality-gates",
  ["Remover o scenario da spec não é regressão"],
  () => {
  // "Second thing" is gone from the spec, and so is the test that covered it.
  withSpecs({ alpha: ["First thing"], beta: ["Third thing"] }, (specsDir) => {
    const verdict = verify({
      declared: declaredSet(["alpha", "First thing"], ["beta", "Third thing"]),
      specsDir,
      record: RECORD,
      outOfScope: [],
    });

    assert.equal(verdict.ok, true);
    assert.deepEqual(verdict.regressed, []);
    assert.deepEqual(verdict.undeclared, []);
  });
});

test("an unchanged covered set is not a regression", () => {
  withSpecs(SPECS, (specsDir) => {
    const verdict = verify({
      declared: declaredSet(
        ["alpha", "First thing"],
        ["alpha", "Second thing"],
        ["beta", "Third thing"]
      ),
      specsDir,
      record: RECORD,
      outOfScope: [],
    });

    assert.equal(verdict.ok, true);
    assert.equal(verdict.coveredCount, 3);
    assert.equal(verdict.specifiedCount, 3);
  });
});

// =========================================================================
// The record on disk
// =========================================================================

test("the record is written grouped by capability and sorted, so a diff shows movement", () => {
  withSpecs(SPECS, (specsDir) => {
    const path = join(specsDir, "coverage.json");
    const specs = readSpecScenarios(specsDir);

    writeRecord(
      declaredSet(["beta", "Third thing"], ["alpha", "Second thing"]),
      specs,
      path
    );

    const text = readFileSync(path, "utf8");
    assert.equal(text.endsWith("\n"), true);
    assert.deepEqual(JSON.parse(text), {
      covered: { alpha: ["Second thing"], beta: ["Third thing"] },
    });
    // Capabilities in sorted order, so nothing reorders between commits.
    assert.ok(text.indexOf('"alpha"') < text.indexOf('"beta"'));
  });
});

test("a missing record reads as no coverage rather than failing", () => {
  assert.deepEqual(readRecord(join(tmpdir(), "no-such-coverage-record.json")), {
    covered: {},
  });
});

test("the declarations of a run are read back from what the suite left", () => {
  const dir = mkdtempSync(join(tmpdir(), "opsx-gate-decl-"));
  try {
    writeFileSync(
      join(dir, "111.jsonl"),
      `${JSON.stringify({ capability: "alpha", title: "First thing" })}\n`
    );
    writeFileSync(
      join(dir, "222.jsonl"),
      // The same pair twice, from two processes: a set, so counted once.
      `${JSON.stringify({ capability: "alpha", title: "First thing" })}\n` +
        `${JSON.stringify({ capability: "beta", title: "Third thing" })}\n`
    );

    const declared = readDeclared(dir);

    assert.equal(declared.size, 2);
    assert.ok(declared.has(scenarioKey("alpha", "First thing")));
    assert.ok(declared.has(scenarioKey("beta", "Third thing")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// =========================================================================
// The report
// =========================================================================

testCovering(
  "a refusal names every uncovered scenario under its own capability",
  "quality-gates",
  ["Os scenarios descobertos são listados"],
  () => {
  withSpecs(SPECS, (specsDir) => {
    const verdict = verify({ declared: new Set(), specsDir, outOfScope: [] });

    const text = report(verdict);

    assert.match(text, /FAILED — specified scenarios with no test and no declaration/);
    assert.match(text, /^ {2}alpha {2}\(2\)$/m);
    assert.match(text, /^ {4}- First thing$/m);
    assert.match(text, /^ {4}- Second thing$/m);
    assert.match(text, /^ {2}beta {2}\(1\)$/m);
    assert.match(text, /^ {4}- Third thing$/m);
    // And how to satisfy it, so the reader does not have to work that out.
    assert.match(text, /declare it out of scope/);
  });
});

testCovering(
  "a refusal says which check failed, and a regression is not confused with a gap",
  "quality-gates",
  ["A verificação que falhou é identificada"],
  () => {
  withSpecs(SPECS, (specsDir) => {
    const regression = report(
      verify({
        declared: declaredSet(["alpha", "First thing"], ["beta", "Third thing"]),
        specsDir,
        record: RECORD,
        outOfScope: [
          { capability: "alpha", title: "Second thing", reason: "n/a" },
        ],
      })
    );

    assert.match(regression, /FAILED — scenario coverage regressed/);
    assert.match(regression, /- Second thing/);
    assert.ok(!regression.includes("no test and no declaration"));
  });
});

test("the totals stand at the end of every report, refused or not", () => {
  withSpecs(SPECS, (specsDir) => {
    const passing = report(
      verify({
        declared: declaredSet(
          ["alpha", "First thing"],
          ["alpha", "Second thing"],
          ["beta", "Third thing"]
        ),
        specsDir,
        outOfScope: [],
      })
    );
    const failing = report(
      verify({ declared: new Set(), specsDir, outOfScope: [] })
    );

    assert.match(passing, /^scenario coverage: ok$/m);
    assert.match(
      passing,
      /3\/3 specified scenarios covered · 0 out of scope · 0 uncovered/
    );
    // Partial coverage is never presented as enough: the distance is stated.
    assert.match(
      failing,
      /0\/3 specified scenarios covered · 0 out of scope · 3 uncovered/
    );
  });
});

test("a rejected out-of-scope entry is reported as its own failure", () => {
  withSpecs(SPECS, (specsDir) => {
    const text = report(
      verify({
        declared: declaredSet(
          ["alpha", "First thing"],
          ["alpha", "Second thing"],
          ["beta", "Third thing"]
        ),
        specsDir,
        outOfScope: [{ capability: "beta", title: "Third thing", reason: "" }],
      })
    );

    assert.match(text, /FAILED — out-of-scope declarations that do not count/);
    assert.match(text, /beta \/ Third thing: no reason given/);
  });
});

test("an out-of-scope entry is a plain object anyone can read in a diff", () => {
  const entries: OutOfScopeEntry[] = OUT_OF_SCOPE;

  for (const entry of entries) {
    assert.equal(typeof entry.capability, "string");
    assert.equal(typeof entry.title, "string");
    assert.equal(typeof entry.reason, "string");
  }
});
