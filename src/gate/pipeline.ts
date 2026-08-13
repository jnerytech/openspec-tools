/**
 * The gate's sequence, separated from the process that runs it.
 *
 * The order is a statement, not a preference: types first, so a type error is
 * reported as a type error rather than as forty failing tests; then the suite,
 * which is also the run that collects what each test declares; then scenario
 * coverage, which needs that run to have happened.
 *
 * The steps are injected so the order and the short-circuiting can be checked
 * without compiling this repository or running its suite - which is the only
 * honest way to assert "the gate refuses without the suite's result being
 * needed to decide".
 */

import { report, verify, type Verdict } from "./verify.js";

export type StepName = "types" | "suite" | "coverage";

export interface StepOutcome {
  ok: boolean;
  /** Anything the step wants shown, such as a line-coverage report. */
  output?: string;
}

export interface GateSteps {
  /** Compiles src/ with the test files included. Emits nothing to dist/. */
  types(): StepOutcome;
  /**
   * Runs the suite, collecting the scenario declarations. `lineCoverage` is
   * the diagnostic report — produced always, never consulted for the verdict.
   */
  suite(): StepOutcome & { declared: Set<string>; lineCoverage?: string };
  /** The scenario-coverage verdict over what the suite declared. */
  coverage(declared: Set<string>): Verdict;
}

export interface GateResult {
  ok: boolean;
  /** The step that refused, or undefined when nothing did. */
  failed?: StepName;
  /** Steps actually run, in order — a short circuit shows up as a short list. */
  ran: StepName[];
  lines: string[];
  verdict?: Verdict;
}

/**
 * Runs the gate and says what happened. Line coverage is printed whenever the
 * suite produced it and never enters the verdict: it is there to point at code
 * no test exercises, which is a thing to look at, not a thing to fail on.
 */
export function runGate(steps: GateSteps): GateResult {
  const lines: string[] = [];
  const ran: StepName[] = [];

  ran.push("types");
  const types = steps.types();
  if (types.output) lines.push(types.output);
  if (!types.ok) {
    lines.push("FAILED — the type check did not pass. Nothing else was run.");
    return { ok: false, failed: "types", ran, lines };
  }

  ran.push("suite");
  const suite = steps.suite();
  if (suite.output) lines.push(suite.output);
  if (suite.lineCoverage) {
    lines.push("");
    lines.push("line coverage (diagnostic — it decides nothing):");
    lines.push(suite.lineCoverage);
  }
  if (!suite.ok) {
    lines.push("FAILED — the test suite did not pass.");
    return { ok: false, failed: "suite", ran, lines };
  }

  ran.push("coverage");
  const verdict = steps.coverage(suite.declared);
  lines.push(report(verdict));

  return {
    ok: verdict.ok,
    failed: verdict.ok ? undefined : "coverage",
    ran,
    lines,
    verdict,
  };
}

/** The default coverage step: the real verifier over the real specs. */
export function verifyStep(declared: Set<string>): Verdict {
  return verify({ declared });
}
