import assert from "node:assert/strict";
import { runGate, type GateSteps } from "./pipeline.js";
import { testCovering } from "../test-fixture.js";
import type { Verdict } from "./verify.js";

/**
 * The order the gate refuses in, checked without compiling this repository or
 * running its suite. The steps are injected, which is the only honest way to
 * assert that a failing type check decides the gate *without the suite's result
 * being needed* - a real run would have to produce that result to be observed.
 */

const CLEAN: Verdict = {
  ok: true,
  undeclared: [],
  regressed: [],
  rejected: [],
  coveredCount: 3,
  specifiedCount: 3,
  outOfScopeCount: 0,
};

const DIRTY: Verdict = {
  ...CLEAN,
  ok: false,
  undeclared: [{ capability: "alpha", title: "First thing" }],
  coveredCount: 2,
};

/** Steps that all pass, with hooks for a case to override one of them. */
function steps(overrides: Partial<GateSteps> = {}): GateSteps & {
  calls: string[];
} {
  const calls: string[] = [];
  const base: GateSteps = {
    types: () => {
      calls.push("types");
      return { ok: true };
    },
    suite: () => {
      calls.push("suite");
      return { ok: true, declared: new Set<string>() };
    },
    coverage: () => {
      calls.push("coverage");
      return CLEAN;
    },
  };

  const merged: GateSteps = {
    types: overrides.types
      ? () => {
          calls.push("types");
          return overrides.types!();
        }
      : base.types,
    suite: overrides.suite
      ? () => {
          calls.push("suite");
          return overrides.suite!();
        }
      : base.suite,
    coverage: overrides.coverage
      ? (declared) => {
          calls.push("coverage");
          return overrides.coverage!(declared);
        }
      : base.coverage,
  };

  return Object.assign(merged, { calls });
}

// =========================================================================
// The order
// =========================================================================

testCovering(
  "a type error refuses the gate without the suite being run at all",
  "quality-gates",
  ["A verificação de tipos vem antes"],
  () => {
    const injected = steps({ types: () => ({ ok: false }) });

    const result = runGate(injected);

    assert.equal(result.ok, false);
    assert.equal(result.failed, "types");
    // The suite never ran, so its result cannot have entered the decision.
    assert.deepEqual(injected.calls, ["types"]);
    assert.deepEqual(result.ran, ["types"]);
    assert.ok(result.lines.join("\n").includes("the type check did not pass"));
    assert.equal(result.verdict, undefined);
  }
);

testCovering(
  "a type error refuses even when every test would have passed",
  "quality-gates",
  ["Um erro de tipo recusa mesmo com a suíte passando"],
  () => {
    // The suite is wired to pass and coverage to be clean; only the types fail.
    const injected = steps({
      types: () => ({ ok: false, output: "src/x.ts(1,1): error TS2322: ..." }),
      suite: () => ({ ok: true, declared: new Set<string>() }),
      coverage: () => CLEAN,
    });

    const result = runGate(injected);

    assert.equal(result.ok, false);
    assert.equal(result.failed, "types");
    // And the report points at the type error itself.
    assert.match(result.lines.join("\n"), /error TS2322/);
  }
);

testCovering(
  "with the types clean, the gate runs the suite and then the coverage check",
  "quality-gates",
  ["Um commit passa pelo portão"],
  () => {
    const injected = steps();

    const result = runGate(injected);

    assert.equal(result.ok, true);
    assert.deepEqual(injected.calls, ["types", "suite", "coverage"]);
    assert.equal(result.failed, undefined);
    assert.equal(result.verdict?.ok, true);
  }
);

testCovering(
  "a failing suite refuses before the coverage check is reached",
  "quality-gates",
  ["A verificação que falhou é identificada"],
  () => {
    const injected = steps({
      suite: () => ({ ok: false, declared: new Set<string>() }),
    });

    const result = runGate(injected);

    assert.equal(result.ok, false);
    assert.equal(result.failed, "suite");
    assert.deepEqual(injected.calls, ["types", "suite"]);
    assert.match(result.lines.join("\n"), /the test suite did not pass/);
  }
);

// =========================================================================
// Line coverage: reported, never decisive
// =========================================================================

testCovering(
  "line coverage is reported on every run and decides nothing",
  "quality-gates",
  ["A cobertura de linha é relatada como diagnóstico"],
  () => {
    // A dismal line percentage, and everything else clean.
    const table = "# all files | 3.20 | 1.10 | 2.00 |";
    const injected = steps({
      suite: () => ({
        ok: true,
        declared: new Set<string>(),
        lineCoverage: table,
      }),
    });

    const result = runGate(injected);

    const text = result.lines.join("\n");
    assert.ok(text.includes(table), "the table is reported");
    assert.match(text, /diagnostic — it decides nothing/);
    // Reported, and the gate still passes: no floor participates.
    assert.equal(result.ok, true);
    assert.equal(result.failed, undefined);
  }
);

testCovering(
  "scenario coverage is what refuses, whatever the line percentage says",
  "quality-gates",
  ["O critério é o scenario, não a linha"],
  () => {
    // Perfect lines, a missing scenario: the gate refuses.
    const injected = steps({
      suite: () => ({
        ok: true,
        declared: new Set<string>(),
        lineCoverage: "# all files | 100.00 | 100.00 | 100.00 |",
      }),
      coverage: () => DIRTY,
    });

    const result = runGate(injected);

    assert.equal(result.ok, false);
    assert.equal(result.failed, "coverage");
    assert.match(result.lines.join("\n"), /alpha/);
    assert.match(result.lines.join("\n"), /First thing/);
  }
);

testCovering(
  "the totals reach the report the gate prints, not only the verdict",
  "quality-gates",
  ["Os scenarios descobertos são listados"],
  () => {
    const result = runGate(steps({ coverage: () => DIRTY }));

    assert.match(
      result.lines.join("\n"),
      /2\/3 specified scenarios covered · 0 out of scope · 1 uncovered/
    );
  }
);
