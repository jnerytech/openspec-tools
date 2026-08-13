/**
 * Runs the CLI the way a user does: as a compiled binary in its own process.
 *
 * `usageError` and the provisioning guard end in `process.exit(1)`, which
 * cannot be observed from inside the test process. Replacing those with a typed
 * exception is the better design and is deliberately out of scope here - 45
 * scenarios of `cli-interface` describe exit codes and message order, and none
 * of them has a test yet. A subprocess covers the same behaviour without
 * touching a line of production code, and is what makes that refactor safe
 * later.
 *
 * The binary comes from the check-time compile, never from `dist/`: `dist/` is
 * versioned and may lag `src/`, and a test that passes against stale code is
 * worse than no test, because it asserts what it did not verify.
 *
 * COST, measured when this was written (32 subprocess cases):
 *
 *   type check                ~0.95 s
 *   every other test file      ~0.74 s
 *   this file alone            ~4.0 s
 *   whole gate                 ~5 s
 *
 * Tolerable for a pre-commit as it stands. `design.md` names this part as the
 * one that leaves the hook first if that stops being true - it is the most
 * expensive per scenario covered, and the type check, which is cheap and closes
 * the hole of greatest consequence, is the last thing to go. Re-measure before
 * deciding: the number above is what the decision was made against.
 */

import { spawn, spawnSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { REPO_ROOT } from "./scenarios.js";

const OUT_DIR = join(REPO_ROOT, ".tscheck");
const BIN = join(OUT_DIR, "main.js");
const SRC = join(REPO_ROOT, "src");

function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = resolve(dir, entry.name);
    newest = Math.max(
      newest,
      entry.isDirectory() ? newestMtime(abs) : statSync(abs).mtimeMs
    );
  }
  return newest;
}

function mtimeOrZero(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

let built: string | null = null;

/**
 * Compiles once per process and reuses the result afterwards. The compile is
 * skipped entirely when the binary is already newer than every source file,
 * which is the normal case under the gate: the type check ran first and left
 * exactly this output behind.
 */
export function buildOnce(): string {
  if (built) return built;

  if (mtimeOrZero(BIN) <= newestMtime(SRC)) {
    const compiled = spawnSync(
      process.execPath,
      [
        join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc"),
        "-p",
        join(REPO_ROOT, "tsconfig.check.json"),
      ],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );

    if (mtimeOrZero(BIN) === 0) {
      throw new Error(
        `could not build the CLI for the subprocess suite:\n${compiled.stdout}${compiled.stderr}`
      );
    }
  }

  built = BIN;
  return built;
}

export interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
  /** Standard output and standard error in one string, for loose matching. */
  output: string;
}

/**
 * One invocation. Standard input is closed rather than inherited, so every run
 * looks non-interactive - which is the state the CLI must refuse to hang in,
 * and the only state a test can honestly assert about.
 */
export function runCli(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {}
): CliResult {
  const bin = buildOnce();

  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    input: "",
    env: { ...process.env, ...options.env, NO_COLOR: "1" },
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return { stdout, stderr, code: result.status ?? -1, output: stdout + stderr };
}

/**
 * The same, but through a pseudo-terminal, so the CLI sees an interactive
 * session and asks its questions instead of refusing. `answers` are fed to the
 * prompts in order; `\n` accepts a default, `y`/`n` answer a confirmation.
 *
 * `script` rather than a pty dependency: this repository adds no package to
 * test itself, and the handful of scenarios that describe *declining* a
 * confirmation cannot be reached any other way - a closed stdin makes the CLI
 * refuse before it ever asks, which is a different behaviour from answering no.
 */
export function runCliInteractive(
  args: string[],
  options: { cwd?: string; answers?: string; timeoutMs?: number } = {}
): CliResult {
  const bin = buildOnce();
  const command = [process.execPath, bin, ...args]
    .map((part) => `'${part.replace(/'/g, `'\\''`)}'`)
    .join(" ");

  const result = spawnSync(
    "script",
    ["-qec", command, "/dev/null"],
    {
      cwd: options.cwd ?? REPO_ROOT,
      encoding: "utf8",
      input: options.answers ?? "",
      timeout: options.timeoutMs ?? 20_000,
      env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
    }
  );

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return { stdout, stderr, code: result.status ?? -1, output: stdout + stderr };
}

export interface ServedReader {
  /** The URL the reader announced, loopback and all. */
  url: string;
  port: number;
  /** Everything the process printed before it announced itself. */
  announcement: string;
  get(path: string): Promise<{ status: number; body: string }>;
}

/**
 * Starts the reader, waits for it to announce its URL, and hands the caller
 * something to fetch from. The process is always killed afterwards, including
 * when the body throws - a leaked reader would hold a port for every later case.
 */
export async function withServer<T>(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> },
  fn: (reader: ServedReader) => Promise<T>
): Promise<T> {
  const bin = buildOnce();
  const child = spawn(process.execPath, [bin, ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...options.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const collect = (chunk: Buffer): void => {
    output += chunk.toString();
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  const announced = await new Promise<RegExpExecArray | null>((settle) => {
    const timer = setTimeout(() => settle(null), 15_000);
    const check = (): void => {
      const match = /http:\/\/localhost:(\d+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        settle(match);
      }
    };
    child.stdout.on("data", check);
    child.stderr.on("data", check);
    child.on("exit", () => {
      clearTimeout(timer);
      settle(/http:\/\/localhost:(\d+)/.exec(output));
    });
  });

  try {
    if (!announced) {
      throw new Error(`the reader never announced a URL:\n${output}`);
    }

    const port = Number(announced[1]);
    const reader: ServedReader = {
      url: announced[0],
      port,
      announcement: output,
      async get(path: string) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`);
        return { status: response.status, body: await response.text() };
      },
    };
    return await fn(reader);
  } finally {
    child.kill("SIGKILL");
  }
}

/**
 * Holds a port for as long as `fn` runs, so a test can assert what the reader
 * does when the address it wanted is already taken.
 */
export async function withPortHeld<T>(
  port: number,
  fn: () => Promise<T>
): Promise<T> {
  const { createServer } = await import("net");
  const blocker = createServer();
  await new Promise<void>((ready, refuse) => {
    blocker.once("error", refuse);
    blocker.listen(port, "127.0.0.1", ready);
  });
  try {
    return await fn();
  } finally {
    await new Promise<void>((done) => blocker.close(() => done()));
  }
}

/** Runs the reader and waits for it to give up, for the cases where it must. */
export function runReaderToExit(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {}
): Promise<CliResult> {
  const bin = buildOnce();
  return new Promise((settle) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: options.cwd ?? REPO_ROOT,
      env: { ...process.env, ...options.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
    child.on("exit", (code) =>
      settle({ stdout, stderr, code: code ?? -1, output: stdout + stderr })
    );
  });
}
