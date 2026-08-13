/**
 * Scenarios no test of this codebase can cover, each with the reason why.
 *
 * This category exists so that an absence of coverage is stated and justified
 * instead of quietly missing. It is deliberately small and deliberately
 * awkward to add to: a reason is mandatory, an entry without one is treated as
 * absent, and every addition shows up as a line in the diff of the commit that
 * made it. A growing list is a thing to argue about in review, not something
 * the gate can decide on its own.
 *
 * What does *not* belong here: anything merely hard, slow, or not written yet.
 * Those are uncovered scenarios, and the gate is meant to name them.
 */

import { readSpecScenarios, scenarioKey, SPECS_DIR } from "./scenarios.js";

export interface OutOfScopeEntry {
  capability: string;
  /** A literal scenario title, or "*" for every scenario of the capability. */
  title: string;
  reason: string;
}

export const OUT_OF_SCOPE: OutOfScopeEntry[] = [
  {
    capability: "change-summary",
    title: "*",
    reason:
      "The capability specifies the content of skills/openspec-summarize-change/SKILL.md — " +
      "an instruction file an agent reads, not behaviour of this package's TypeScript. " +
      "Nothing here parses, evaluates or executes it, so no test of this codebase can " +
      "assert what it specifies: the subject is a prompt, and judging a prompt is a " +
      "reading, not an assertion. The file's presence and text are reviewed by hand.",
  },
];

export interface OutOfScopeResolution {
  /** Keys that are validly declared out of scope, with a reason. */
  declared: Set<string>;
  /** Entries rejected, and why — a missing reason, or a title nothing matches. */
  rejected: { entry: OutOfScopeEntry; problem: string }[];
}

/**
 * Expands the declaration against the specs as they are now. An entry whose
 * reason is blank is dropped rather than honoured, so the scenario it names
 * goes back to being simply uncovered — which is the whole point of requiring
 * one. An entry naming a scenario that no longer exists is reported too: it is
 * stale, and a stale exemption is how this list would rot.
 */
export function resolveOutOfScope(
  entries: OutOfScopeEntry[] = OUT_OF_SCOPE,
  specsDir: string = SPECS_DIR
): OutOfScopeResolution {
  const specs = readSpecScenarios(specsDir);
  const declared = new Set<string>();
  const rejected: { entry: OutOfScopeEntry; problem: string }[] = [];

  for (const entry of entries) {
    if (entry.reason.trim() === "") {
      rejected.push({ entry, problem: "no reason given" });
      continue;
    }

    const titles = specs.get(entry.capability);
    if (titles === undefined) {
      rejected.push({
        entry,
        problem: `no capability "${entry.capability}" under openspec/specs/`,
      });
      continue;
    }

    if (entry.title === "*") {
      for (const title of titles) {
        declared.add(scenarioKey(entry.capability, title));
      }
      continue;
    }

    if (!titles.includes(entry.title)) {
      rejected.push({
        entry,
        problem: `"${entry.capability}" declares no scenario "${entry.title}"`,
      });
      continue;
    }

    declared.add(scenarioKey(entry.capability, entry.title));
  }

  return { declared, rejected };
}
