import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { buildProgram, VERSION } from "./program.js";
import { ExitError, isExitError } from "./exit.js";
import { startServer } from "./server.js";
import { resolveProject } from "./project.js";
import { derivePort } from "./port.js";
import { testCovering, withFiles } from "./test-fixture.js";

/**
 * The same commands the subprocess suite drives, driven here instead — in the
 * process the coverage instrumentation is measuring.
 *
 * The subprocess tests stay: they are what verifies the exit code and the
 * stream a real invocation produces, which is what `cli-interface` specifies
 * and which nothing inside a process can demonstrate. What these add is that
 * the production code they exercise is exercised somewhere the measurement can
 * see, so a covered module is never reported as untouched.
 */

const PROJECT: Record<string, string> = {
  "openspec/config.yaml": "schema: spec-driven\n",
  "openspec/changes/add-dark-mode/proposal.md": "# Proposal\n\nSome text.\n",
};

interface Ran {
  error?: ExitError;
  stdout: string[];
  stderr: string[];
}

/**
 * Runs one invocation against a working directory, capturing what it wrote and
 * the refusal it threw, if any. Commander is told to throw rather than exit for
 * its own errors, which is what `main.ts` arranges by catching.
 */
async function run(argv: string[], cwd: string): Promise<Ran> {
  const previousCwd = process.cwd();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: unknown[]) => void stdout.push(args.join(" "));
  console.error = (...args: unknown[]) => void stderr.push(args.join(" "));
  console.warn = (...args: unknown[]) => void stderr.push(args.join(" "));
  process.chdir(cwd);

  try {
    const program = buildProgram();
    program.exitOverride();
    program.configureOutput({
      writeOut: (str) => void stdout.push(str),
      writeErr: (str) => void stderr.push(str),
    });
    for (const sub of program.commands) {
      sub.exitOverride();
      sub.configureOutput({
        writeOut: (str) => void stdout.push(str),
        writeErr: (str) => void stderr.push(str),
      });
    }

    await program.parseAsync(argv, { from: "user" });
    return { stdout, stderr };
  } catch (err) {
    if (isExitError(err)) return { error: err, stdout, stderr };
    // Commander's own errors carry an exitCode; anything else is a real fault.
    const code = (err as { exitCode?: number }).exitCode;
    if (typeof code === "number") {
      return {
        error: new ExitError((err as Error).message, [], code),
        stdout,
        stderr,
      };
    }
    throw err;
  } finally {
    process.chdir(previousCwd);
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
}

const said = (ran: Ran): string =>
  [...ran.stdout, ...ran.stderr, ran.error?.message ?? "", ...(ran.error?.details ?? [])].join("\n");

function treeOf(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(resolve(dir, entry.name), rel);
      else out.push(rel);
    }
  };
  walk(root, "");
  return out.sort();
}

// =========================================================================
// The reader's target resolution
// =========================================================================

testCovering(
  "an unresolvable target refuses in process, naming every location tried",
  "cli-interface",
  ["Unresolvable target lists both attempts", "An unresolvable positional word is a target error"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const ran = await run(["read", "teste"], root);

      assert.ok(ran.error, "the invocation refused");
      assert.equal(ran.error?.code, 1);
      const text = said(ran);
      assert.match(text, /Target 'teste' not found/);
      assert.match(text, /openspec\/changes\/teste/);
      assert.match(text, /openspec\/changes\/archive\/teste/);
      assert.ok(!/unknown command/i.test(text));
    });
  }
);

testCovering(
  "a close name is suggested, and the available ones are listed otherwise",
  "cli-interface",
  ["Close match is suggested", "Available changes are listed when no close match exists"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const near = await run(["read", "add-dark-mod"], root);
      assert.match(said(near), /Did you mean\?/);
      assert.match(said(near), /add-dark-mode/);

      const far = await run(["read", "zzzzzzzzzzzz"], root);
      assert.match(said(far), /Available open changes:/);
      assert.match(said(far), /add-dark-mode/);
    });
  }
);

testCovering(
  "with no open changes at all, the error says so",
  "cli-interface",
  ["Empty change set is stated"],
  async () => {
    await withFiles(
      { "openspec/config.yaml": "schema: spec-driven\n", "openspec/changes/.keep": "" },
      async (root) => {
        const ran = await run(["read", "zzzzzzzzzzzz"], root);

        assert.match(said(ran), /There are no open changes in openspec\/changes\//);
      }
    );
  }
);

testCovering(
  "an archived name close to the target is suggested and marked",
  "cli-interface",
  ["Archived name is suggested and marked"],
  async () => {
    await withFiles(
      {
        "openspec/config.yaml": "schema: spec-driven\n",
        "openspec/changes/archive/2026-08-10-improve-cli-errors/proposal.md": "# p\n",
      },
      async (root) => {
        const ran = await run(["read", "improve-cli-errrors"], root);

        assert.match(said(ran), /improve-cli-errors\s+\(archived\)/);
      }
    );
  }
);

testCovering(
  "a file that is not Markdown is refused as a target",
  "cli-interface",
  ["An unresolvable positional word is a target error"],
  async () => {
    await withFiles({ ...PROJECT, "notes.txt": "not markdown\n" }, async (root) => {
      const ran = await run(["read", "notes.txt"], root);

      assert.ok(ran.error);
      assert.match(said(ran), /Not a Markdown file/);
    });
  }
);

testCovering(
  "an invalid port value refuses before anything is bound",
  "cli-interface",
  ["Invalid port value is still a usage error", "Usage errors fail"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const ran = await run(["read", "--port", "abc"], root);

      assert.ok(ran.error);
      assert.equal(ran.error?.code, 1);
      assert.match(said(ran), /Port must be a number/);
    });
  }
);

testCovering(
  "an unknown option refuses and names itself",
  "cli-interface",
  ["Unknown option is reported, not swallowed", "Mistyped option does not become a target"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const unknown = await run(["read", "--bananas"], root);
      assert.ok(unknown.error);
      assert.match(said(unknown), /--bananas/);

      const mistyped = await run(["read", "--prot", "8080"], root);
      assert.ok(mistyped.error);
      assert.match(said(mistyped), /--prot/);
      assert.ok(!/Target '8080'/.test(said(mistyped)));
    });
  }
);

// =========================================================================
// Provisioning
// =========================================================================

testCovering(
  "provisioning refuses in process where there is no OpenSpec project",
  "project-provisioning",
  ["An unmet precondition exits one", "A repository without OpenSpec is refused"],
  async () => {
    await withFiles({ "README.md": "# Repo\n" }, async (root) => {
      const before = treeOf(root);

      const ran = await run(["init", "--commit-rule", "--yes"], root);

      assert.ok(ran.error);
      assert.equal(ran.error?.code, 1);
      assert.match(said(ran), /No OpenSpec project here/);
      assert.match(said(ran), /Run 'openspec init' to create one/);
      assert.deepEqual(treeOf(root), before);
    });
  }
);

testCovering(
  "provisioning applies the selection in process and reports what it wrote",
  "project-provisioning",
  ["An OpenSpec project is provisioned", "Completing successfully exits zero", "Supplied choices skip the prompts"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const ran = await run(["init", "--commit-rule", "--lang", "pt-BR", "--yes"], root);

      assert.equal(ran.error, undefined, said(ran));
      assert.ok(existsSync(resolve(root, ".claude/rules/commit-convention.md")));
      assert.match(
        readFileSync(resolve(root, "openspec/config.yaml"), "utf8"),
        /Português \(Brasil\)/
      );
      assert.match(said(ran), /Done\./);
    });
  }
);

testCovering(
  "a damaged region refuses the provisioning in process, writing nothing",
  "commit-convention-rule",
  ["Delimitadores danificados impedem a escrita"],
  async () => {
    const damaged = "<!-- opsx-tools:commit-convention -->\nhalf a region\n";

    await withFiles(
      { ...PROJECT, ".claude/rules/commit-convention.md": damaged },
      async (root) => {
        const ran = await run(["init", "--commit-rule", "--yes"], root);

        assert.ok(ran.error);
        assert.equal(ran.error?.code, 1);
        assert.match(said(ran), /cannot be provisioned/);
        assert.match(said(ran), /Nothing was written/);
        assert.equal(
          readFileSync(resolve(root, ".claude/rules/commit-convention.md"), "utf8"),
          damaged
        );
      }
    );
  }
);

testCovering(
  "a missing choice with no terminal refuses, naming the option that supplies it",
  "project-provisioning",
  ["Missing choice without a terminal is an error"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const ran = await run(["init"], root);

      assert.ok(ran.error);
      assert.match(said(ran), /must be supplied when input is not a terminal/);
      assert.match(said(ran), /--lang/);
    });
  }
);

// =========================================================================
// Skills
// =========================================================================

testCovering(
  "installing and removing a skill runs in process",
  "skill-installation",
  ["Scripted install", "Removal names its targets before deleting"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const installed = await run(
        ["skill", "install", "openspec-review-change", "--project", "--yes"],
        root
      );
      assert.equal(installed.error, undefined, said(installed));
      const target = resolve(root, ".claude/skills/openspec-review-change");
      assert.ok(existsSync(target));

      const removed = await run(
        ["skill", "remove", "openspec-review-change", "--project", "--yes"],
        root
      );
      assert.equal(removed.error, undefined, said(removed));
      assert.ok(said(removed).includes(target));
      assert.ok(!existsSync(target));
    });
  }
);

testCovering(
  "an unknown skill name refuses in process, listing the real ones",
  "skill-installation",
  ["Unknown skill name lists the real ones"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const ran = await run(
        ["skill", "install", "no-such-skill", "--project", "--yes"],
        root
      );

      assert.ok(ran.error);
      assert.match(said(ran), /Unknown skill: no-such-skill/);
      assert.match(said(ran), /openspec-review-change/);
    });
  }
);

testCovering(
  "listing reports each skill at each destination without writing",
  "skill-installation",
  ["State is reported per destination"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const before = treeOf(root);

      const ran = await run(["skill", "list"], root);

      assert.equal(ran.error, undefined, said(ran));
      assert.match(said(ran), /openspec-review-change/);
      assert.deepEqual(treeOf(root), before);
    });
  }
);

// =========================================================================
// The reader itself
// =========================================================================

testCovering(
  "the reader binds, serves and closes, all in process",
  "server-startup",
  ["Startup names the project", "Derived port binds loopback only"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const project = resolveProject(root);
      const previousCwd = process.cwd();
      const originalLog = console.log;
      const said: string[] = [];
      console.log = (...args: unknown[]) => void said.push(args.join(" "));
      process.chdir(root);

      try {
        const reader = await startServer({
          project,
          mode: { kind: "changes", changesDir: resolve(root, "openspec/changes") },
          openBrowser: false,
          archived: false,
        });

        try {
          assert.equal(reader.port, derivePort(project.root));
          assert.match(reader.url, /^http:\/\/localhost:\d+$/);
          assert.ok(said.join("\n").includes(`project: ${project.name}`));

          const page = await fetch(`http://127.0.0.1:${reader.port}/`);
          assert.equal(page.status, 200);
          assert.match(await page.text(), /add-dark-mode/);
        } finally {
          await reader.close();
        }
      } finally {
        process.chdir(previousCwd);
        console.log = originalLog;
      }
    });
  }
);

testCovering(
  "a requested port that is busy refuses in process rather than substituting",
  "server-startup",
  ["Busy requested port is an error"],
  async () => {
    await withFiles(PROJECT, async (root) => {
      const project = resolveProject(root);
      const { createServer } = await import("net");
      const blocker = createServer();
      await new Promise<void>((ready) =>
        blocker.listen(0, "127.0.0.1", () => ready())
      );
      const held = (blocker.address() as { port: number }).port;

      const originalLog = console.log;
      console.log = () => {};
      try {
        await assert.rejects(
          () =>
            startServer({
              requestedPort: held,
              project,
              mode: { kind: "changes", changesDir: resolve(root, "openspec/changes") },
              openBrowser: false,
              archived: false,
            }),
          (err: unknown) => {
            assert.ok(isExitError(err));
            assert.equal((err as ExitError).code, 1);
            assert.match((err as ExitError).message, /already in use/);
            return true;
          }
        );
      } finally {
        console.log = originalLog;
        await new Promise<void>((done) => blocker.close(() => done()));
      }
    });
  }
);

testCovering(
  "the version the program reports is the package's own",
  "cli-interface",
  ["One version for the whole package"],
  () => {
    const pkg = JSON.parse(
      readFileSync(resolve(resolveProject(process.cwd()).root, "package.json"), "utf8")
    ) as { version: string };

    assert.equal(VERSION, pkg.version);
  }
);
