/**
 * The whole gate, as a process. The sequence itself lives in `pipeline.ts`;
 * this supplies the three steps and the exit code.
 *
 * Run by `.githooks/pre-commit`. Nothing here is a feature of `opsx-tools`:
 * this is how this repository holds itself to its own specs, and no subcommand
 * reaches it, no component provisions it, and none of it is written into a
 * user's project.
 *
 *   npm run gate            check, and refuse on any of the three
 *   npm run gate -- --write rewrite the coverage record from this run
 */

import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { verifyCodeCoverage } from "./code-coverage.js";
import { runGate, verifyStep } from "./pipeline.js";
import { readSpecScenarios, REPO_ROOT } from "./scenarios.js";
import { readDeclared, writeRecord, RECORD_PATH } from "./verify.js";

const write = process.argv.includes("--write");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(
  label: string,
  command: string,
  args: string[],
  env: Record<string, string> = {}
): { ok: boolean; stdout: string } {
  process.stdout.write(`\n── ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    // Inherited for stderr so a compiler error keeps its shape; stdout is
    // captured because the coverage table is pulled out of it.
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { ok: (result.status ?? 1) === 0, stdout: result.stdout ?? "" };
}

/**
 * Node prints the table between two markers. Lifted out rather than shown with
 * the whole test log, so the diagnostic is readable where it is meant to be
 * read - and its absence is not silent.
 */
function lineCoverageTable(stdout: string): string {
  // The marker carries the reporter's own prefix, so it is matched loosely.
  const start = stdout.search(/start of coverage report/);
  const end = stdout.search(/end of coverage report/);
  if (start === -1 || end === -1) return "  (not produced)";
  return stdout
    .slice(start, end)
    .split("\n")
    .slice(1, -1)
    .join("\n")
    .trimEnd();
}

const collected = mkdtempSync(join(tmpdir(), "opsx-tools-coverage-"));
const lcovPath = join(collected, "coverage.lcov");
let declaredForRecord: Set<string> = new Set();

try {
  const result = runGate({
    types: () => {
      const { ok } = run("type check", npm, ["run", "--silent", "typecheck"]);
      return { ok };
    },

    suite: () => {
      // One run: it produces the scenario declarations and the line-coverage
      // diagnostic together, so the two can never describe different runs.
      // Node directly rather than through npm: the suite needs two reporters
      // at once — one to read, one to parse — and npm's own argument handling
      // does not carry a pair of them through intact.
      const { ok, stdout } = run(
        "test suite",
        process.execPath,
        [
          "--enable-source-maps",
          "--experimental-test-module-mocks",
          "--test",
          "--experimental-test-coverage",
          "--test-reporter=spec",
          "--test-reporter-destination=stdout",
          "--test-reporter=lcov",
          `--test-reporter-destination=${lcovPath}`,
          ".tscheck/**/*.test.js",
        ],
        { OPSX_COVERAGE_DIR: collected }
      );
      const declared = readDeclared(collected);
      declaredForRecord = declared;

      // Only the tail of the log: a passing run of four hundred cases is not
      // worth reprinting, and a failing one puts its failures at the end.
      const log = stdout.split(/.?.?\s*start of coverage report/)[0].trimEnd();
      const tail = log.split("\n").slice(-12).join("\n");
      return { ok, declared, output: tail, lineCoverage: lineCoverageTable(stdout) };
    },

    coverage: (declared) => {
      if (write) {
        writeRecord(declared, readSpecScenarios(), RECORD_PATH);
        console.log(
          `\nrecorded ${declared.size} covered scenarios in ${RECORD_PATH}`
        );
      }
      return verifyStep(declared);
    },

    code: () =>
      verifyCodeCoverage({
        lcov: readFileSync(lcovPath, "utf8"),
        compiledDir: join(REPO_ROOT, ".tscheck"),
      }),
  });

  if (result.ran.includes("coverage")) process.stdout.write("\n── coverage\n");
  for (const line of result.lines) console.log(line);

  if (!result.ok) {
    console.error("\nThe commit was refused. Fix the above, or use");
    console.error("`git commit --no-verify` to bypass the gate deliberately.");
    process.exit(1);
  }
} finally {
  rmSync(collected, { recursive: true, force: true });
  void declaredForRecord;
}
