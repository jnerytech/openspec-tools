/**
 * The second criterion: every line, branch and function of production code is
 * exercised, or is marked as deliberately not exercised with the reason beside
 * it.
 *
 * Why this reads lcov rather than the summary Node prints: the summary honours
 * the exclusion directives but names only *lines* — for a branch or a function
 * it gives a percentage and nothing to go and look at. The lcov report names
 * every position and honours no directive at all. Neither is enough on its own,
 * so the exclusions are applied here, to the positions lcov gives.
 *
 * That also settles a thing the directives cannot do by themselves. A function
 * inside a disabled block still counts as uncovered, because "covered" for a
 * function means it was called, and excluding its body does not call it. Applying
 * the ranges here treats a function like a line: inside an excluded region, it
 * is not required.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import { REPO_ROOT } from "./scenarios.js";

/** Where production code lives, and what within it the floor does not cover. */
const SRC = join(REPO_ROOT, "src");
const NOT_PRODUCTION = [/\.test\.ts$/, /^gate\//, /^test-fixture\.ts$/];

/**
 * The denominator, read from disk rather than from the report: a file no test
 * imports has no entry in the coverage data at all, and taking the report's
 * word for what exists is what lets deleting a test raise the number.
 */
export function productionFiles(srcDir: string = SRC): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const abs = join(dir, entry.name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      const rel = relative(srcDir, abs);
      if (NOT_PRODUCTION.some((pattern) => pattern.test(rel))) continue;
      found.push(rel);
    }
  };

  walk(srcDir);
  return found;
}

export interface FileCoverage {
  /** line number -> times executed */
  lines: Map<number, number>;
  branches: { line: number; taken: boolean }[];
  functions: { line: number; name: string; hit: boolean }[];
}

/** What the lcov report says, per file, keyed by path relative to the repo. */
export function parseLcov(text: string): Map<string, FileCoverage> {
  const byFile = new Map<string, FileCoverage>();
  let current: FileCoverage | null = null;
  const fnLines = new Map<string, number>();

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      current = { lines: new Map(), branches: [], functions: [] };
      fnLines.clear();
      byFile.set(line.slice(3), current);
    } else if (!current) {
      continue;
    } else if (line.startsWith("FN:")) {
      const [at, ...rest] = line.slice(3).split(",");
      fnLines.set(rest.join(","), Number(at));
    } else if (line.startsWith("FNDA:")) {
      const [count, ...rest] = line.slice(5).split(",");
      const name = rest.join(",");
      current.functions.push({
        line: fnLines.get(name) ?? 0,
        name,
        hit: Number(count) > 0,
      });
    } else if (line.startsWith("DA:")) {
      const [at, count] = line.slice(3).split(",");
      current.lines.set(Number(at), Number(count));
    } else if (line.startsWith("BRDA:")) {
      const [at, , , taken] = line.slice(5).split(",");
      current.branches.push({ line: Number(at), taken: taken !== "-" && taken !== "0" });
    }
  }

  return byFile;
}

export interface Exclusions {
  /** Line numbers inside a `disable`/`enable` pair or an `ignore next`. */
  excluded: Set<number>;
  /** Lines carrying no executable code: blank, comment, directive, shebang. */
  nonCode: Set<number>;
  /** An exclusion whose reason is missing, by the line the directive is on. */
  withoutReason: number[];
}

const DISABLE = /\/\*\s*node:coverage disable\s*\*\//;
const ENABLE = /\/\*\s*node:coverage enable\s*\*\//;
const IGNORE = /\/\*\s*node:coverage ignore next(?:\s+(\d+))?\s*\*\//;
const REASON = /coverage reason:/i;

/**
 * Where a file says it is deliberately not exercised, and where it carries no
 * code to exercise.
 *
 * A reason is mandatory and is looked for in the comment lines immediately
 * above the directive. Without one the exclusion does not count, which puts the
 * lines back under the floor — the same rule a scenario declared out of scope
 * without a reason gets.
 */
export function readExclusions(source: string): Exclusions {
  const lines = source.split("\n");
  const excluded = new Set<number>();
  const nonCode = new Set<number>();
  const withoutReason: number[] = [];

  const hasReasonNear = (index: number): boolean =>
    hasReasonAbove(index) || hasReasonBelow(index);

  const hasReasonBelow = (index: number): boolean => {
    for (let i = index + 1; i < Math.min(index + 6, lines.length); i++) {
      const text = lines[i].trim();
      if (REASON.test(text)) return true;
      const isComment =
        text === "" ||
        text.startsWith("//") ||
        text.startsWith("*") ||
        text.startsWith("/*") ||
        text.endsWith("*/");
      if (!isComment) return false;
    }
    return false;
  };

  const hasReasonAbove = (index: number): boolean => {
    for (let i = index - 1; i >= 0; i--) {
      const text = lines[i].trim();
      if (text === "") return false;
      if (REASON.test(text)) return true;
      const isComment =
        text.startsWith("//") ||
        text.startsWith("*") ||
        text.startsWith("/*") ||
        text.endsWith("*/");
      if (!isComment) return false;
    }
    return false;
  };

  let disabledFrom: number | null = null;

  lines.forEach((raw, index) => {
    const at = index + 1;
    const text = raw.trim();

    if (
      text === "" ||
      text.startsWith("//") ||
      text.startsWith("/*") ||
      text.startsWith("*") ||
      text.startsWith("#!")
    ) {
      nonCode.add(at);
    }

    if (DISABLE.test(raw)) {
      if (!hasReasonNear(index)) withoutReason.push(at);
      disabledFrom = at;
      return;
    }

    if (ENABLE.test(raw) && disabledFrom !== null) {
      for (let i = disabledFrom; i <= at; i++) excluded.add(i);
      disabledFrom = null;
      return;
    }

    const ignore = IGNORE.exec(raw);
    if (ignore) {
      if (!hasReasonNear(index)) withoutReason.push(at);
      const span = Number(ignore[1] ?? "1");
      for (let i = at; i <= at + span; i++) excluded.add(i);
    }
  });

  // An unterminated `disable` runs to the end of the file, which is what Node
  // does with it too.
  if (disabledFrom !== null) {
    for (let i = disabledFrom; i <= lines.length; i++) excluded.add(i);
  }

  return { excluded, nonCode, withoutReason };
}

export interface FileVerdict {
  file: string;
  /** Positions the floor requires and the run did not reach. */
  uncoveredLines: number[];
  uncoveredBranches: number[];
  uncoveredFunctions: { line: number; name: string }[];
  /** Directives that do not count because no reason accompanies them. */
  exclusionsWithoutReason: number[];
  /** True when the file has no coverage data at all. */
  unmeasured: boolean;
}

export interface CodeCoverageVerdict {
  ok: boolean;
  files: FileVerdict[];
  measuredFiles: number;
  totalFiles: number;
}

/**
 * Crosses the report with the source. A position is required unless the file
 * says otherwise: excluded with a reason, or carrying no code at all.
 */
/**
 * Whether a source file produces any runtime code at all. A module of nothing
 * but `interface` and `type` compiles to an empty one, is erased from every
 * import that names it, and is therefore never loaded — which is why it has no
 * coverage data, and why demanding some would be demanding the impossible.
 */
export function declaresOnlyTypes(compiledPath: string): boolean {
  let compiled: string;
  try {
    compiled = readFileSync(compiledPath, "utf8");
  } catch {
    return false;
  }

  const code = compiled
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line !== "" && !line.startsWith("//") && line !== "export {};"
    );
  return code.length === 0;
}

export function verifyCodeCoverage(options: {
  lcov: string;
  srcDir?: string;
  repoRoot?: string;
  /** Where the compiled output is, for telling a type-only module apart. */
  compiledDir?: string;
}): CodeCoverageVerdict {
  const srcDir = options.srcDir ?? SRC;
  const root = options.repoRoot ?? REPO_ROOT;
  const coverage = parseLcov(options.lcov);
  const files = productionFiles(srcDir);
  const verdicts: FileVerdict[] = [];
  let measured = 0;

  for (const rel of files) {
    const key = relative(root, resolve(srcDir, rel));
    const data = coverage.get(key);
    const source = readFileSync(resolve(srcDir, rel), "utf8");
    const { excluded, nonCode, withoutReason } = readExclusions(source);

    const required = (line: number): boolean =>
      !excluded.has(line) && !nonCode.has(line);

    if (!data && options.compiledDir) {
      const compiled = resolve(options.compiledDir, rel.replace(/\.ts$/, ".js"));
      if (declaresOnlyTypes(compiled)) continue;
    }

    if (!data) {
      // No entry at all: nothing imported it. That is a file with no test,
      // not a file that needs none, and it counts as fully uncovered.
      verdicts.push({
        file: rel,
        uncoveredLines: [],
        uncoveredBranches: [],
        uncoveredFunctions: [],
        exclusionsWithoutReason: withoutReason,
        unmeasured: true,
      });
      continue;
    }

    measured++;
    verdicts.push({
      file: rel,
      uncoveredLines: [...data.lines]
        .filter(([line, hits]) => hits === 0 && required(line))
        .map(([line]) => line)
        .sort((a, b) => a - b),
      uncoveredBranches: [
        ...new Set(
          data.branches
            .filter((b) => !b.taken && required(b.line))
            .map((b) => b.line)
        ),
      ].sort((a, b) => a - b),
      uncoveredFunctions: data.functions
        .filter((fn) => !fn.hit && required(fn.line))
        .map(({ line, name }) => ({ line, name }))
        .sort((a, b) => a.line - b.line),
      exclusionsWithoutReason: withoutReason,
      unmeasured: false,
    });
  }

  const ok = verdicts.every(
    (v) =>
      !v.unmeasured &&
      v.uncoveredLines.length === 0 &&
      v.uncoveredBranches.length === 0 &&
      v.uncoveredFunctions.length === 0 &&
      v.exclusionsWithoutReason.length === 0
  );

  return { ok, files: verdicts, measuredFiles: measured, totalFiles: verdicts.length };
}

/** What the gate says when the code is not fully exercised. */
export function reportCodeCoverage(verdict: CodeCoverageVerdict): string {
  const lines: string[] = [];
  const failing = verdict.files.filter(
    (f) =>
      f.unmeasured ||
      f.uncoveredLines.length > 0 ||
      f.uncoveredBranches.length > 0 ||
      f.uncoveredFunctions.length > 0 ||
      f.exclusionsWithoutReason.length > 0
  );

  if (failing.length > 0) {
    lines.push("FAILED — production code that no test exercises");
    lines.push("");
    lines.push(
      "  Cover each position with a test, or mark it as deliberately not"
    );
    lines.push(
      "  exercised with a `// Coverage reason:` comment above the directive:"
    );

    for (const file of failing) {
      lines.push("");
      lines.push(`  src/${file.file}`);
      if (file.unmeasured) {
        lines.push("    no coverage data at all — no test imports this file");
      }
      if (file.uncoveredLines.length > 0) {
        lines.push(`    lines     ${file.uncoveredLines.join(", ")}`);
      }
      if (file.uncoveredBranches.length > 0) {
        lines.push(`    branches  ${file.uncoveredBranches.join(", ")}`);
      }
      for (const fn of file.uncoveredFunctions) {
        lines.push(`    function  ${fn.name} (line ${fn.line})`);
      }
      for (const at of file.exclusionsWithoutReason) {
        lines.push(`    line ${at}: exclusion with no reason — it does not count`);
      }
    }
    lines.push("");
  }

  lines.push(
    `  ${verdict.measuredFiles}/${verdict.totalFiles} production files measured · ` +
      `${verdict.files.length - failing.length}/${verdict.totalFiles} fully exercised`
  );

  if (verdict.ok) lines.unshift("code coverage: ok", "");

  return lines.join("\n");
}
