import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { COMPONENTS } from "../components/index.js";
import { runCli } from "./cli-runner.js";
import { REPO_ROOT } from "./scenarios.js";
import { testCovering, withFiles } from "../test-fixture.js";

/**
 * The line between what this repository imposes on itself and what the package
 * promises anyone else. The gate is engineering, never product: no component
 * provisions it, no subcommand runs it, and nothing of it reaches a user's
 * project.
 *
 */

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
  "openspec/changes/.keep": "",
};

/** Every path the gate owns, by the name it would have in a user's project. */
const GATE_ARTEFACTS = [
  ".githooks",
  "coverage.lcov",
  ".githooks/pre-commit",
  "tsconfig.check.json",
  "openspec/coverage.json",
  ".tscheck",
  "src/gate",
];

function treeOf(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      out.push(rel);
      if (entry.isDirectory()) walk(resolve(dir, entry.name), rel);
    }
  };
  walk(root, "");
  return out.sort();
}

testCovering(
  "no component the init command offers installs the gate",
  "quality-gates",
  ["Nenhum componente provisiona o portão"],
  () => {
  for (const component of COMPONENTS) {
    const described = `${component.id} ${component.label} ${component.summary}`;
    assert.ok(
      !/gate|hook|typecheck|coverage|pre-commit/i.test(described),
      `${component.id} does not offer the gate: ${described}`
    );
  }

  // And the listed set is exactly the four that existed before this change.
  assert.deepEqual(
    COMPONENTS.map((c) => c.id),
    ["skills", "lang", "claude-workflow", "commit-convention"]
  );
});

testCovering(
  "no subcommand runs the gate, and none is documented as doing so",
  "quality-gates",
  ["Nenhum subcomando expõe o portão"],
  () => {
  const root = runCli(["--help"]);
  assert.equal(root.code, 0);

  const helps = [root.stdout];
  for (const sub of [["read"], ["skill"], ["init"], ["skill", "install"]]) {
    const help = runCli([...sub, "--help"]);
    assert.equal(help.code, 0, sub.join(" "));
    helps.push(help.stdout);
  }

  for (const text of helps) {
    for (const word of ["gate", "coverage.json", "typecheck", "pre-commit"]) {
      assert.ok(!text.includes(word), `no help text offers "${word}"`);
    }
  }

  // No subcommand by that name, either.
  for (const name of ["gate", "verify", "check"]) {
    const attempt = runCli([name]);
    assert.equal(attempt.code, 1, name);
    assert.match(attempt.stderr, /unknown command/i);
  }
});

testCovering(
  "provisioning a project writes no file belonging to the gate",
  "quality-gates",
  ["Nada do portão alcança um projeto de usuário"],
  async () => {
  await withFiles(PROJECT, async (root) => {
    const before = treeOf(root);

    // Every component this package offers, all at once.
    const { code } = runCli(
      [
        "init",
        "--skills",
        "--project",
        "--lang",
        "pt-BR",
        "--todos",
        "--questions",
        "--commit-rule",
        "--yes",
      ],
      { cwd: root }
    );
    assert.equal(code, 0);

    const written = treeOf(root).filter((path) => !before.includes(path));
    assert.ok(written.length > 0, "something was provisioned");

    for (const artefact of GATE_ARTEFACTS) {
      assert.ok(
        !existsSync(join(root, artefact)),
        `${artefact} does not reach a user's project`
      );
    }
    for (const path of written) {
      assert.ok(
        !/githooks|tsconfig\.check|coverage\.json|tscheck/.test(path),
        `provisioning wrote ${path}`
      );
    }
  });
});

test("the gate is excluded from what the package publishes", () => {
  const tsconfig = readFileSync(join(REPO_ROOT, "tsconfig.json"), "utf8");

  // Kept out of the published build, so it does not even ship as dead code.
  assert.match(tsconfig, /"src\/gate"/);

  // And nothing under dist/ carries it.
  const dist = join(REPO_ROOT, "dist");
  if (existsSync(dist)) {
    assert.ok(!existsSync(join(dist, "gate")), "dist/ carries no gate/");
  }
});

test("no packaged skill installs or mentions the gate as something to run", () => {
  const skills = join(REPO_ROOT, "skills");
  for (const entry of readdirSync(skills, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = join(skills, entry.name, "SKILL.md");
    if (!existsSync(manifest)) continue;

    const text = readFileSync(manifest, "utf8");
    assert.ok(
      !/npm run gate|coverage\.json|tsconfig\.check/.test(text),
      `${entry.name} does not carry the gate`
    );
  }
});

test("the floor covers what the package ships, and not the tests or the gate", async () => {
  const { productionFiles } = await import("./code-coverage.js");

  const files = productionFiles();

  assert.ok(files.length > 20, "the real tree is what is measured");
  for (const file of files) {
    assert.ok(!file.endsWith(".test.ts"), file);
    assert.ok(!file.startsWith("gate/"), file);
    assert.notEqual(file, "test-fixture.ts");
  }
  // And what it does cover is what `tsconfig.json` publishes.
  assert.ok(files.includes("main.ts"));
  assert.ok(files.includes("server.ts"));
});

testCovering(
  "no production module depends on a spawned process to be exercised",
  "quality-gates",
  ["Nenhum código de produção é exercitado apenas fora da medição"],
  async () => {
    const { productionFiles } = await import("./code-coverage.js");
    const { readFileSync } = await import("fs");

    // Every production module is reachable from a test running in this
    // process — directly, or through another module that a test imports. A
    // module reachable only by spawning the binary would be reported as
    // untouched however well it is tested, which is the failure this rules out.
    const read = (rel: string): string =>
      readFileSync(join(REPO_ROOT, "src", rel), "utf8");

    const suites = readdirSync(join(REPO_ROOT, "src"), { recursive: true })
      .map(String)
      .filter((name) => name.endsWith(".test.ts"));

    const reached = new Set<string>();
    const walk = (source: string): void => {
      for (const match of source.matchAll(/from\s+["']([^"']+\.js)["']/g)) {
        const rel = match[1].replace(/^\.\.\//, "").replace(/^\.\//, "");
        const asTs = rel.replace(/\.js$/, ".ts");
        const candidates = [asTs, `components/${asTs}`, `gate/${asTs}`];
        for (const candidate of candidates) {
          if (reached.has(candidate)) continue;
          try {
            const next = read(candidate);
            reached.add(candidate);
            walk(next);
          } catch {
            // Not a module of this tree — a package, or a different folder.
          }
        }
      }
    };

    for (const suite of suites) walk(read(suite));

    const { readExclusions } = await import("./code-coverage.js");

    /** A module that declares its whole self out of the measurement. */
    const whollyExcluded = (rel: string): boolean => {
      const source = read(rel);
      const { excluded, nonCode } = readExclusions(source);
      const total = source.split("\n").length;
      for (let at = 1; at <= total; at++) {
        if (!excluded.has(at) && !nonCode.has(at)) return false;
      }
      return true;
    };

    for (const file of productionFiles()) {
      assert.ok(
        reached.has(file) || whollyExcluded(file),
        `${file} is reachable only by spawning a process, and says nothing ` +
          `about why that is allowed`
      );
    }

    // And exactly one module is in that position: the process entry point.
    const onlyOutOfProcess = productionFiles().filter(
      (file) => !reached.has(file)
    );
    assert.deepEqual(onlyOutOfProcess, ["main.ts"]);
  }
);

testCovering(
  "the subprocess suite is still there, verifying what only a process shows",
  "quality-gates",
  ["O teste de processo separado permanece como verificação adicional"],
  () => {
    const subprocess = readFileSync(
      join(REPO_ROOT, "src", "cli-subprocess.test.ts"),
      "utf8"
    );

    // It runs the real binary and asserts on the code it exits with, which is
    // what `cli-interface` specifies and what no in-process call can show.
    assert.match(subprocess, /runCli\(/);
    assert.match(subprocess, /assert\.equal\(code, 1\)/);
    assert.match(subprocess, /assert\.equal\(code, 0/);

    // And the same paths are exercised in process, where they are measured.
    const inProcess = readFileSync(
      join(REPO_ROOT, "src", "cli-inprocess.test.ts"),
      "utf8"
    );
    assert.match(inProcess, /buildProgram\(\)/);
    assert.match(inProcess, /isExitError/);
  }
);
