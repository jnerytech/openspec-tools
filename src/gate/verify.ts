/**
 * The scenario-coverage check: the third and last thing the gate runs, after
 * the type check and the suite.
 *
 * It crosses three inputs and refuses on either of two grounds:
 *
 *   1. a scenario in `openspec/specs/` that no test declared and that is not
 *      declared out of scope with a reason; and
 *   2. a scenario that the versioned record says was covered and that is not
 *      covered now — a regression, checked by set rather than by count, so
 *      covering something new never pays for losing something old.
 *
 * The record is a versioned file, which makes every movement of coverage, in
 * either direction, a line in the diff of the commit that caused it.
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { resolveOutOfScope, type OutOfScopeEntry } from "./out-of-scope.js";
import {
  readSpecScenarios,
  REPO_ROOT,
  scenarioKey,
  SPECS_DIR,
  type ScenarioRef,
} from "./scenarios.js";

/** Where the covered set is kept between runs. Versioned, and read as data. */
export const RECORD_PATH = join(REPO_ROOT, "openspec", "coverage.json");

export interface CoverageRecord {
  /** capability -> the scenario titles covered when this was last written. */
  covered: Record<string, string[]>;
}

/** Everything the suite declared, gathered from one run's output directory. */
export function readDeclared(dir: string): Set<string> {
  const declared = new Set<string>();
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return declared;
  }

  // Only what the fixture writes: the same directory may hold other output
  // from the same run, and a stray file is not a set of declarations.
  for (const file of files.filter((name) => name.endsWith(".jsonl"))) {
    const text = readFileSync(join(dir, file), "utf8");
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      const ref = JSON.parse(line) as ScenarioRef;
      declared.add(scenarioKey(ref.capability, ref.title));
    }
  }
  return declared;
}

export function readRecord(path: string = RECORD_PATH): CoverageRecord {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CoverageRecord;
  } catch {
    return { covered: {} };
  }
}

/** Sorted on the way out, so the diff shows movement and never reordering. */
export function writeRecord(
  covered: Set<string>,
  specs: Map<string, string[]>,
  path: string = RECORD_PATH
): void {
  const byCapability: Record<string, string[]> = {};
  for (const [capability, titles] of specs) {
    const mine = titles
      .filter((title) => covered.has(scenarioKey(capability, title)))
      .sort();
    if (mine.length > 0) byCapability[capability] = mine;
  }

  const ordered: Record<string, string[]> = {};
  for (const capability of Object.keys(byCapability).sort()) {
    ordered[capability] = byCapability[capability];
  }

  writeFileSync(path, `${JSON.stringify({ covered: ordered }, null, 2)}\n`, "utf8");
}

export interface Verdict {
  ok: boolean;
  /** In `openspec/specs/`, covered by no test and declared nowhere. */
  undeclared: ScenarioRef[];
  /** Recorded as covered, still specified, and not covered now. */
  regressed: ScenarioRef[];
  /** Out-of-scope entries that do not count, and why. */
  rejected: { capability: string; title: string; problem: string }[];
  coveredCount: number;
  specifiedCount: number;
  outOfScopeCount: number;
}

export function verify(options: {
  declared: Set<string>;
  specsDir?: string;
  record?: CoverageRecord;
  /** Defaults to this repository's own declaration; overridden in its tests. */
  outOfScope?: OutOfScopeEntry[];
}): Verdict {
  const specs = readSpecScenarios(options.specsDir ?? SPECS_DIR);
  const { declared: outOfScope, rejected } = resolveOutOfScope(
    options.outOfScope,
    options.specsDir ?? SPECS_DIR
  );
  const record = options.record ?? readRecord();

  const undeclared: ScenarioRef[] = [];
  const regressed: ScenarioRef[] = [];
  let coveredCount = 0;
  let specifiedCount = 0;

  for (const [capability, titles] of specs) {
    for (const title of titles) {
      specifiedCount++;
      const key = scenarioKey(capability, title);
      const covered = options.declared.has(key);
      if (covered) coveredCount++;

      // Refuses on a scenario that is neither covered nor declared out of
      // scope. A scenario that has left `openspec/specs/` is not iterated at
      // all, which is exactly why removing it from the spec is not a
      // regression: the behaviour it described is gone with it.
      if (!covered && !outOfScope.has(key)) {
        undeclared.push({ capability, title });
      }

      // Recorded as covered, still specified, no longer covered.
      if (!covered && record.covered[capability]?.includes(title)) {
        regressed.push({ capability, title });
      }
    }
  }

  return {
    ok: undeclared.length === 0 && regressed.length === 0 && rejected.length === 0,
    undeclared,
    regressed,
    rejected: rejected.map(({ entry, problem }) => ({
      capability: entry.capability,
      title: entry.title,
      problem,
    })),
    coveredCount,
    specifiedCount,
    outOfScopeCount: outOfScope.size,
  };
}

/** Groups refs under their capability, for a report that reads like the specs. */
function grouped(refs: ScenarioRef[]): Map<string, string[]> {
  const byCapability = new Map<string, string[]>();
  for (const { capability, title } of refs) {
    const titles = byCapability.get(capability) ?? [];
    titles.push(title);
    byCapability.set(capability, titles);
  }
  return byCapability;
}

/**
 * What the gate says when it refuses. Whoever reads it must not have to
 * reconstruct the list the gate already had: every scenario is named under its
 * capability, the failing check is identified, and the totals stand at the end
 * so partial coverage is never mistaken for enough.
 */
export function report(verdict: Verdict): string {
  const lines: string[] = [];

  if (verdict.regressed.length > 0) {
    lines.push("FAILED — scenario coverage regressed");
    lines.push("");
    lines.push(
      "  These were covered and are not any more. They are still specified,"
    );
    lines.push("  so losing their tests is a regression, not a removal:");
    for (const [capability, titles] of grouped(verdict.regressed)) {
      lines.push("");
      lines.push(`  ${capability}`);
      for (const title of titles.sort()) lines.push(`    - ${title}`);
    }
    lines.push("");
  }

  if (verdict.undeclared.length > 0) {
    lines.push("FAILED — specified scenarios with no test and no declaration");
    lines.push("");
    lines.push(
      "  Cover each with a test that declares it, or declare it out of scope"
    );
    lines.push("  with a reason in src/gate/out-of-scope.ts:");
    for (const [capability, titles] of grouped(verdict.undeclared)) {
      lines.push("");
      lines.push(`  ${capability}  (${titles.length})`);
      for (const title of titles.sort()) lines.push(`    - ${title}`);
    }
    lines.push("");
  }

  if (verdict.rejected.length > 0) {
    lines.push("FAILED — out-of-scope declarations that do not count");
    lines.push("");
    for (const { capability, title, problem } of verdict.rejected) {
      lines.push(`  ${capability} / ${title}: ${problem}`);
    }
    lines.push("");
  }

  const uncovered =
    verdict.specifiedCount - verdict.coveredCount - verdict.outOfScopeCount;
  lines.push(
    `  ${verdict.coveredCount}/${verdict.specifiedCount} specified scenarios covered · ` +
      `${verdict.outOfScopeCount} out of scope · ${uncovered} uncovered`
  );

  if (verdict.ok) lines.unshift("scenario coverage: ok", "");

  return lines.join("\n");
}
