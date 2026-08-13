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
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runGate, verifyStep } from "./pipeline.js";
import { readSpecScenarios, REPO_ROOT } from "./scenarios.js";
import { readDeclared, writeRecord, RECORD_PATH } from "./verify.js";

const write = process.argv.includes("--write");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(
  args: string[],
  env: Record<string, string> = {}
): { ok: boolean; stdout: string } {
  process.stdout.write(`\n── ${args[args.length - 1]}\n`);
  const result = spawnSync(npm, args, {
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
  const start = stdout.indexOf("# start of coverage report");
  const end = stdout.indexOf("# end of coverage report");
  if (start === -1 || end === -1) return "  (not produced)";
  return stdout.slice(start, end).split("\n").slice(1).join("\n").trimEnd();
}

const collected = mkdtempSync(join(tmpdir(), "opsx-tools-coverage-"));
let declaredForRecord: Set<string> = new Set();

try {
  const result = runGate({
    types: () => {
      const { ok } = run(["run", "--silent", "typecheck"]);
      return { ok };
    },

    suite: () => {
      // One run: it produces the scenario declarations and the line-coverage
      // diagnostic together, so the two can never describe different runs.
      const { ok, stdout } = run(["run", "--silent", "coverage"], {
        OPSX_COVERAGE_DIR: collected,
      });
      const declared = readDeclared(collected);
      declaredForRecord = declared;

      // The test log itself, minus the coverage table, which is printed on its
      // own below.
      const log = stdout.split("# start of coverage report")[0].trimEnd();
      return { ok, declared, output: log, lineCoverage: lineCoverageTable(stdout) };
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
