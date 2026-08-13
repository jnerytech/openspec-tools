import { test } from "node:test";
import assert from "node:assert/strict";
import { runGate, type GateSteps } from "./pipeline.js";
import type { CodeCoverageVerdict } from "./code-coverage.js";
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

const CODE_CLEAN: CodeCoverageVerdict = {
  ok: true,
  files: [],
  measuredFiles: 3,
  totalFiles: 3,
};

const CODE_DIRTY: CodeCoverageVerdict = {
  ok: false,
  files: [
    {
      file: "server.ts",
      uncoveredLines: [42],
      uncoveredBranches: [],
      uncoveredFunctions: [],
      exclusionsWithoutReason: [],
      unmeasured: false,
    },
  ],
  measuredFiles: 3,
  totalFiles: 3,
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
    code: () => {
      calls.push("code");
      return CODE_CLEAN;
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
    code: overrides.code
      ? () => {
          calls.push("code");
          return overrides.code!();
        }
      : base.code,
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
    assert.deepEqual(injected.calls, ["types", "suite", "coverage", "code"]);
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
  ["As três medidas são relatadas mesmo quando o portão aceita"],
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
  ["Um scenario descoberto recusa mesmo com cobertura total de código"],
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

testCovering(
  "a scenario left undefended refuses before the code floor is even measured",
  "quality-gates",
  ["O critério de scenario é verificado primeiro"],
  () => {
    const injected = steps({ coverage: () => DIRTY });

    const result = runGate(injected);

    assert.equal(result.ok, false);
    assert.equal(result.failed, "coverage");
    // The code floor never ran: the more actionable failure decided it.
    assert.deepEqual(injected.calls, ["types", "suite", "coverage"]);
  }
);

testCovering(
  "code that no test reaches refuses even when every scenario is covered",
  "quality-gates",
  ["Código não exercitado recusa mesmo com todo scenario coberto", "O arquivo e a medida que falharam são nomeados"],
  () => {
    const injected = steps({ code: () => CODE_DIRTY });

    const result = runGate(injected);

    assert.equal(result.ok, false);
    assert.equal(result.failed, "code");
    assert.deepEqual(injected.calls, ["types", "suite", "coverage", "code"]);
    const text = result.lines.join("\n");
    assert.match(text, /production code that no test exercises/);
    assert.match(text, /server\.ts/);
    assert.match(text, /lines\s+42/);
  }
);

testCovering(
  "an undefended scenario refuses even when the code floor is met",
  "quality-gates",
  ["Um scenario descoberto recusa mesmo com cobertura total de código"],
  () => {
    const injected = steps({ coverage: () => DIRTY, code: () => CODE_CLEAN });

    const result = runGate(injected);

    assert.equal(result.ok, false);
    assert.equal(result.failed, "coverage");
  }
);
