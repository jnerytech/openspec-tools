import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { appendFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { test } from "node:test";
import { readSpecScenarios, type ScenarioRef } from "./gate/scenarios.js";

/**
 * Builds a throwaway tree holding exactly `relPaths`, hands its root to `fn`,
 * and removes it afterwards. Fixtures are written by the test rather than
 * versioned so that each case states, in its own body, which artifacts it is
 * ordering - including shapes this repository does not happen to contain.
 *
 * The root is whatever the caller needs it to be: a change directory, a
 * changes directory holding several, or one holding an `archive/`.
 */
export async function withTree<T>(
  relPaths: string[],
  fn: (root: string) => Promise<T>
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "opsx-tools-test-"));
  try {
    for (const rel of relPaths) {
      const full = join(root, rel);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, `# ${rel}\n`, "utf-8");
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/**
 * The same, for a tree whose contents matter: each entry is a path and the
 * bytes to put there. `withTree` writes a placeholder line, which is enough to
 * order artifacts by name and not enough to inspect a component's state.
 */
export async function withFiles<T>(
  files: Record<string, string>,
  fn: (root: string) => Promise<T>
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "opsx-tools-test-"));
  try {
    for (const [rel, contents] of Object.entries(files)) {
      const full = join(root, rel);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, contents, "utf-8");
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/**
 * The reading order as the page actually presents it: the "On this page" list,
 * which both `renderChange` and `renderFiles` build from the same sequence they
 * render the sections in.
 */
export function tocNames(html: string): string[] {
  const items = html.matchAll(/<a href="#(?:artifact|section)-\d+">([^<]+)<\/a>/g);
  return [...items].map((m) => m[1]);
}

/** The artifact names of a scanned change, in the order it presents them. */
export function names(artifacts: { name: string }[]): string[] {
  return artifacts.map((a) => a.name);
}

/**
 * Where a gate run asks the suite to leave what it declared. Unset for a plain
 * `npm test`, which is why running the tests writes nothing: the declaration is
 * checked on every run, but only collected when something is going to read it.
 */
const COVERAGE_DIR = "OPSX_COVERAGE_DIR";

/** Lazy, and read once: the specs do not change while the suite runs. */
let specs: Map<string, string[]> | null = null;

function canonicalScenarios(): Map<string, string[]> {
  if (specs === null) specs = readSpecScenarios();
  return specs;
}

const declared = new Set<string>();
let writerInstalled = false;

/**
 * Each test file runs in its own process under `node --test`, so an in-memory
 * registry would die with it. One file per process, named by pid, keeps the
 * writes from interleaving without any locking.
 *
 * The file is only written when a gate run asks for it. A plain `npm test`
 * still registers in memory and still checks every declaration; it just leaves
 * nothing behind, because nothing is going to read it.
 */
function collect(capability: string, title: string): void {
  declared.add(JSON.stringify({ capability, title }));

  const dir = process.env[COVERAGE_DIR];
  if (!dir || writerInstalled) return;
  writerInstalled = true;

  process.on("exit", () => {
    mkdirSync(dir, { recursive: true });
    const lines = [...declared].map((key) => `${key}\n`).join("");
    appendFileSync(join(dir, `${process.pid}.jsonl`), lines, "utf8");
  });
}

/**
 * Checks the declaration against the specs, right where it is made. A
 * capability that does not exist, or a title that is not in that capability's
 * spec, throws naming both - which brings the run down rather than leaving a
 * scenario silently uncovered because a title was mistyped.
 *
 * This is also what makes renaming a scenario break, in the same run, the test
 * that covered it: the check is against the spec as it is now, never against a
 * copy of it kept somewhere else.
 */
export function checkDeclaration(capability: string, titles: string[]): void {
  const byCapability = canonicalScenarios();
  const known = byCapability.get(capability);

  if (known === undefined) {
    throw new Error(
      `covers: no capability "${capability}" under openspec/specs/ ` +
        `(known: ${[...byCapability.keys()].join(", ")})`
    );
  }

  for (const title of titles) {
    if (!known.includes(title)) {
      throw new Error(
        `covers: capability "${capability}" declares no scenario ` +
          `"${title}" — the spec was renamed, or the title is mistyped`
      );
    }
  }
}

/**
 * Registers `titles` of `capability` as covered by this test, and runs it.
 *
 * The declaration lives in the test body's own call rather than in a map kept
 * beside the code: deleting the test deletes the claim with it, which is the
 * one property a separate mapping file cannot have.
 */
export function testCovering(
  name: string,
  capability: string,
  titles: string[],
  body: () => void | Promise<void>
): void {
  checkDeclaration(capability, titles);
  for (const title of titles) collect(capability, title);
  test(name, body);
}

/** What this process has declared so far, for the utility's own tests. */
export function declaredHere(): ScenarioRef[] {
  return [...declared].map((line) => JSON.parse(line) as ScenarioRef);
}
