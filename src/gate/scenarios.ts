/**
 * The denominator of the gate: every scenario this repository has made
 * canonical, keyed by the capability that declares it.
 *
 * Only `openspec/specs/` is read. A change still in planning declares its
 * scenarios under `openspec/changes/`, and those do not count until
 * `openspec archive` promotes them here - which is what keeps specifying free
 * and charges the test at the moment the behaviour starts to hold.
 *
 * Nothing in this directory is published: `tsconfig.json` excludes it, so the
 * gate reaches `dist/` as little as it reaches a user's project.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Resolved from this module's own location rather than from `process.cwd()`,
 * so a test run from a subdirectory reads the same specs as one run from the
 * root. Two levels up from `src/gate/` and from `.tscheck/gate/` alike.
 */
export const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const SPECS_DIR = join(REPO_ROOT, "openspec", "specs");

/** A scenario named the way the gate identifies it: capability plus title. */
export interface ScenarioRef {
  capability: string;
  title: string;
}

/**
 * One string identifying a scenario, for set membership. The separator is an
 * explicit NUL: capability names are directory names and scenario titles are
 * Markdown headings, so neither can contain one, which makes the join
 * unambiguous in a way a space or a slash would not be.
 *
 * Written as an escape on purpose — a literal control character here would be
 * invisible to anyone editing the line, and would break silently.
 */
export function scenarioKey(capability: string, title: string): string {
  return `${capability}\u0000${title}`;
}

const HEADING = /^####\s+Scenario:\s*(.*?)\s*$/;
const FENCE = /^\s*(?:```|~~~)/;

/**
 * The literal titles of the `#### Scenario:` headings in one spec file, in the
 * order they appear. Fenced blocks are skipped: a spec that quotes a heading
 * as an example is showing one, not declaring one.
 */
export function scenarioTitles(markdown: string): string[] {
  const titles: string[] = [];
  let fenced = false;

  for (const line of markdown.split("\n")) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    const match = HEADING.exec(line);
    if (match && match[1] !== "") titles.push(match[1]);
  }

  return titles;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Every canonical scenario, capability by capability. A capability is a
 * directory under `openspec/specs/`, which is the same shape `openspec` itself
 * writes when it archives a change.
 */
export function readSpecScenarios(
  specsDir: string = SPECS_DIR
): Map<string, string[]> {
  const byCapability = new Map<string, string[]>();
  if (!isDirectory(specsDir)) return byCapability;

  for (const entry of readdirSync(specsDir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    const specFile = join(specsDir, entry.name, "spec.md");
    if (!isDirectory(join(specsDir, entry.name))) continue;

    let markdown: string;
    try {
      markdown = readFileSync(specFile, "utf8");
    } catch {
      continue;
    }

    byCapability.set(entry.name, scenarioTitles(markdown));
  }

  return byCapability;
}

/** The same set flattened, for a report that names each scenario once. */
export function flatten(byCapability: Map<string, string[]>): ScenarioRef[] {
  const refs: ScenarioRef[] = [];
  for (const [capability, titles] of byCapability) {
    for (const title of titles) refs.push({ capability, title });
  }
  return refs;
}
