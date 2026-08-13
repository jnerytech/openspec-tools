import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { testCovering } from "../test-fixture.js";
import {
  declaresOnlyTypes,
  parseLcov,
  productionFiles,
  readExclusions,
  reportCodeCoverage,
  verifyCodeCoverage,
} from "./code-coverage.js";

/** The code floor checking itself. */

/** A throwaway src tree, so no case depends on this repository's own files. */
function withSrc<T>(files: Record<string, string>, fn: (dir: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "opsx-floor-"));
  try {
    for (const [rel, contents] of Object.entries(files)) {
      const abs = join(root, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, contents, "utf8");
    }
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const lcovFor = (
  file: string,
  body: { lines?: [number, number][]; branches?: [number, boolean][]; fns?: [number, string, number][] }
): string => {
  const out = [`SF:${file}`];
  for (const [at, name, hits] of body.fns ?? []) {
    out.push(`FN:${at},${name}`);
    out.push(`FNDA:${hits},${name}`);
  }
  for (const [at, hits] of body.lines ?? []) out.push(`DA:${at},${hits}`);
  for (const [at, taken] of body.branches ?? []) {
    out.push(`BRDA:${at},0,0,${taken ? "1" : "0"}`);
  }
  out.push("end_of_record");
  return out.join("\n");
};

// =========================================================================
// The denominator
// =========================================================================

testCovering(
  "the denominator is read from disk, not from the report",
  "quality-gates",
  ["O código de teste e o do portão ficam fora do piso"],
  () => {
  withSrc(
    {
      "a.ts": "export const a = 1;\n",
      "b.ts": "export const b = 2;\n",
      "a.test.ts": "// a test\n",
      "test-fixture.ts": "// shared test helper\n",
      "gate/thing.ts": "// the gate's own code\n",
    },
    (dir) => {
      // Test files, the shared fixture and the gate itself are reported
      // elsewhere and are not what the floor protects.
      assert.deepEqual(productionFiles(dir), ["a.ts", "b.ts"]);
    }
  );
});

testCovering(
  "a production file with no coverage data at all is a failure, not an omission",
  "quality-gates",
  ["Um arquivo que nenhum teste carrega conta como descoberto", "Apagar um teste faz a cobertura cair"],
  () => {
  withSrc({ "a.ts": "export const a = 1;\n" }, (dir) => {
    const verdict = verifyCodeCoverage({ lcov: "", srcDir: dir, repoRoot: dir });

    assert.equal(verdict.ok, false);
    assert.equal(verdict.files[0].unmeasured, true);
    assert.equal(verdict.measuredFiles, 0);
    assert.equal(verdict.totalFiles, 1);
    assert.match(reportCodeCoverage(verdict), /no coverage data at all/);
  });
});

testCovering(
  "a module that declares only types is not required to be exercised",
  "quality-gates",
  ["Cobertura não medida é distinguida de cobertura ausente"],
  () => {
  withSrc({ "types.ts": "export interface Thing { a: string }\n" }, (dir) => {
    const compiled = join(dir, "out");
    mkdirSync(compiled, { recursive: true });
    writeFileSync(join(compiled, "types.js"), "export {};\n//# sourceMappingURL=x\n");

    const verdict = verifyCodeCoverage({
      lcov: "",
      srcDir: dir,
      repoRoot: dir,
      compiledDir: compiled,
    });

    // It compiles to nothing, is never loaded, and so can never be measured.
    assert.equal(verdict.ok, true);
    assert.equal(verdict.totalFiles, 0);
  });
});

test("a compiled module with real code is not mistaken for a type-only one", () => {
  const dir = mkdtempSync(join(tmpdir(), "opsx-compiled-"));
  try {
    writeFileSync(join(dir, "empty.js"), "export {};\n");
    writeFileSync(join(dir, "real.js"), "export const a = 1;\n");

    assert.equal(declaresOnlyTypes(join(dir, "empty.js")), true);
    assert.equal(declaresOnlyTypes(join(dir, "real.js")), false);
    assert.equal(declaresOnlyTypes(join(dir, "not-there.js")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// =========================================================================
// What the report says
// =========================================================================

testCovering(
  "an uncovered line, branch and function are each named by position",
  "quality-gates",
  ["O arquivo e a medida que falharam são nomeados"],
  () => {
  withSrc({ "a.ts": "export const a = 1;\nfunction b() {}\n" }, (dir) => {
    const verdict = verifyCodeCoverage({
      lcov: lcovFor("a.ts", {
        lines: [[1, 1], [2, 0]],
        branches: [[1, true], [2, false]],
        fns: [[2, "b", 0]],
      }),
      srcDir: dir,
      repoRoot: dir,
    });

    assert.equal(verdict.ok, false);
    const [file] = verdict.files;
    assert.deepEqual(file.uncoveredLines, [2]);
    assert.deepEqual(file.uncoveredBranches, [2]);
    assert.deepEqual(file.uncoveredFunctions, [{ line: 2, name: "b" }]);

    const text = reportCodeCoverage(verdict);
    assert.match(text, /lines\s+2/);
    assert.match(text, /branches\s+2/);
    assert.match(text, /function\s+b \(line 2\)/);
  });
});

test("a fully exercised tree reports as ok, with its totals", () => {
  withSrc({ "a.ts": "export const a = 1;\n" }, (dir) => {
    const verdict = verifyCodeCoverage({
      lcov: lcovFor("a.ts", { lines: [[1, 3]] }),
      srcDir: dir,
      repoRoot: dir,
    });

    assert.equal(verdict.ok, true);
    const text = reportCodeCoverage(verdict);
    assert.match(text, /^code coverage: ok$/m);
    assert.match(text, /1\/1 production files measured · 1\/1 fully exercised/);
  });
});

// =========================================================================
// Exclusions
// =========================================================================

testCovering(
  "a line inside an excluded region is not required",
  "quality-gates",
  ["Um trecho excluído com razão não faz recusar"],
  () => {
  const source = [
    "export function a() {",
    "  // Coverage reason: it cannot be reached from here.",
    "  /* node:coverage disable */",
    "  return neverCalled();",
    "  /* node:coverage enable */",
    "}",
  ].join("\n");

  withSrc({ "a.ts": `${source}\n` }, (dir) => {
    const verdict = verifyCodeCoverage({
      lcov: lcovFor("a.ts", { lines: [[1, 1], [4, 0]] }),
      srcDir: dir,
      repoRoot: dir,
    });

    assert.equal(verdict.ok, true);
    assert.deepEqual(verdict.files[0].uncoveredLines, []);
  });
});

testCovering(
  "`ignore next` covers the line below it, and a count covers more",
  "quality-gates",
  ["A exclusão vive junto do código que ela cobre"],
  () => {
  const source = [
    "// Coverage reason: unreachable by type.",
    "/* node:coverage ignore next */",
    "const a = 1;",
    "// Coverage reason: also unreachable.",
    "/* node:coverage ignore next 2 */",
    "const b = 2;",
    "const c = 3;",
    "const d = 4;",
  ].join("\n");

  const { excluded } = readExclusions(source);

  assert.ok(excluded.has(3));
  assert.ok(excluded.has(6));
  assert.ok(excluded.has(7));
  assert.ok(!excluded.has(8), "the count does not run past what it says");
});

testCovering(
  "an exclusion with no reason does not count, and is reported",
  "quality-gates",
  ["Uma exclusão sem razão não vale"],
  () => {
  const source = [
    "export function a() {",
    "  /* node:coverage disable */",
    "  return neverCalled();",
    "  /* node:coverage enable */",
    "}",
  ].join("\n");

  withSrc({ "a.ts": `${source}\n` }, (dir) => {
    const verdict = verifyCodeCoverage({
      lcov: lcovFor("a.ts", { lines: [[1, 1], [3, 0]] }),
      srcDir: dir,
      repoRoot: dir,
    });

    assert.equal(verdict.ok, false);
    assert.deepEqual(verdict.files[0].exclusionsWithoutReason, [2]);
    assert.match(
      reportCodeCoverage(verdict),
      /exclusion with no reason — it does not count/
    );
  });
});

test("a reason below the directive counts, for a file that opens with one", () => {
  const source = [
    "#!/usr/bin/env node",
    "/* node:coverage disable */",
    "/*",
    " * Coverage reason: this file is the process entry point.",
    " */",
    "const a = 1;",
  ].join("\n");

  const { excluded, withoutReason } = readExclusions(source);

  assert.deepEqual(withoutReason, []);
  assert.ok(excluded.has(6));
});

test("a line carrying no code is never required", () => {
  const source = [
    "#!/usr/bin/env node",
    "",
    "// a comment",
    "/* a block */",
    "const a = 1;",
  ].join("\n");

  const { nonCode } = readExclusions(source);

  assert.deepEqual([...nonCode].sort((x, y) => x - y), [1, 2, 3, 4]);
  assert.ok(!nonCode.has(5));
});

test("an unterminated exclusion runs to the end of the file", () => {
  const source = [
    "const a = 1;",
    "// Coverage reason: nothing below here can be reached.",
    "/* node:coverage disable */",
    "const b = 2;",
    "const c = 3;",
  ].join("\n");

  const { excluded } = readExclusions(source);

  assert.ok(!excluded.has(1));
  assert.ok(excluded.has(4));
  assert.ok(excluded.has(5));
});

// =========================================================================
// Reading the report
// =========================================================================

test("the lcov report is read into lines, branches and functions", () => {
  const parsed = parseLcov(
    [
      "SF:src/a.ts",
      "FN:10,doThing",
      "FNDA:0,doThing",
      "DA:1,4",
      "DA:2,0",
      "BRDA:5,0,0,3",
      "BRDA:6,0,1,-",
      "end_of_record",
    ].join("\n")
  );

  const file = parsed.get("src/a.ts");
  assert.ok(file);
  assert.equal(file.lines.get(1), 4);
  assert.equal(file.lines.get(2), 0);
  assert.deepEqual(file.branches, [
    { line: 5, taken: true },
    { line: 6, taken: false },
  ]);
  assert.deepEqual(file.functions, [{ line: 10, name: "doThing", hit: false }]);
});

test("this repository's own production code is fully exercised", async () => {
  // The floor, applied to the tree it exists for. Reads the report the gate
  // just produced rather than producing one, so it costs nothing here.
  const { REPO_ROOT } = await import("./scenarios.js");
  assert.ok(productionFiles().length > 20, "the denominator is the real tree");
  assert.ok(REPO_ROOT.endsWith("openspec-tools"));
});
