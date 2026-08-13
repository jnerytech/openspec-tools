import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findYamlRegion,
  locateContext,
  yamlWithRegion,
} from "./region-yaml.js";
import { testCovering } from "./test-fixture.js";

/**
 * `openspec/config.yaml` is a file the user owns, and `artifact-language`
 * promises every other byte of it comes through an edit unchanged. That promise
 * is kept by line splicing, so these cases assert on whole file contents rather
 * than on a parsed shape - a parse would hide exactly the loss being guarded
 * against.
 */

const ID = "artifact-language";
const OPEN = `  # opsx-tools:${ID} lang=pt-BR`;
const CLOSE = `  # opsx-tools:${ID}:end`;
const BODY = ["Write every artifact in Português (Brasil)."];
const PARAMS = { lang: "pt-BR" };

const lines = (text: string): string[] => text.split("\n");

// --- locating the context key ---------------------------------------------

test("a file with no context key at all", () => {
  assert.deepEqual(locateContext(lines("name: demo\n")), { kind: "absent" });
});

test("an empty file has no context key", () => {
  assert.deepEqual(locateContext([]), { kind: "absent" });
  assert.deepEqual(locateContext(lines("")), { kind: "absent" });
});

/**
 * The state `openspec init` leaves behind, and the one a naive scan gets wrong:
 * the file documents `context` in comments and defines nothing, so it *looks*
 * like it has the key.
 */
test("a context key that is only commented out is not a key", () => {
  const initFile = [
    "# Project context for OpenSpec.",
    "#",
    "# context: |",
    "#   Anything you want every artifact to know.",
    "",
  ];

  assert.deepEqual(locateContext(initFile), { kind: "absent" });
});

test("an indented context key is not the top-level one", () => {
  const nested = lines(["outer:", "  context: |", "    text", ""].join("\n"));

  assert.deepEqual(locateContext(nested), { kind: "absent" });
});

test("a plain block scalar is located, with its body bounds and indent", () => {
  const file = lines(["context: |", "  one", "  two", "next: x", ""].join("\n"));

  const found = locateContext(file);

  assert.equal(found.kind, "block");
  if (found.kind !== "block") return;
  assert.equal(found.keyLine, 0);
  assert.equal(found.bodyStart, 1);
  assert.equal(found.bodyEnd, 3);
  assert.equal(found.indent, "  ");
});

test("a folded scalar is unsupported rather than spliced", () => {
  const found = locateContext(lines("context: >\n  text\n"));

  assert.equal(found.kind, "unsupported");
  if (found.kind !== "unsupported") return;
  assert.match(found.reason, /folded/);
});

test("a block scalar with an indicator is unsupported", () => {
  for (const header of ["|-", "|+", "|2"]) {
    const found = locateContext(lines(`context: ${header}\n  text\n`));

    assert.equal(found.kind, "unsupported", header);
    if (found.kind !== "unsupported") continue;
    assert.match(found.reason, /indicator/);
  }
});

test("a context key holding an inline value is unsupported", () => {
  const found = locateContext(lines("context: some inline text\n"));

  assert.equal(found.kind, "unsupported");
});

test("a context key with no value at all is unsupported", () => {
  const found = locateContext(lines("context:\nnext: x\n"));

  assert.equal(found.kind, "unsupported");
  if (found.kind !== "unsupported") return;
  assert.match(found.reason, /no block scalar/);
});

test("blank lines after the scalar belong to the file, not to the value", () => {
  const file = lines(
    ["context: |", "  one", "", "", "next: x", ""].join("\n")
  );

  const found = locateContext(file);

  assert.equal(found.kind, "block");
  if (found.kind !== "block") return;
  // Body ends after "one" — the two blank lines separate the keys.
  assert.equal(found.bodyEnd, 2);
});

test("a scalar running to the end of the file ends there", () => {
  const found = locateContext(lines(["context: |", "  one", "  two"].join("\n")));

  assert.equal(found.kind, "block");
  if (found.kind !== "block") return;
  assert.equal(found.bodyEnd, 3);
});

test("the indent is read from the scalar's own first content line", () => {
  const found = locateContext(lines("context: |\n    deep\n"));

  assert.equal(found.kind, "block");
  if (found.kind !== "block") return;
  assert.equal(found.indent, "    ");
});

// --- finding the region inside the key ------------------------------------

test("no context key means no region", () => {
  assert.deepEqual(findYamlRegion("name: demo\n", ID), { kind: "absent" });
  assert.deepEqual(findYamlRegion(null, ID), { kind: "absent" });
});

test("an unsupported scalar is reported as damage, not as absent", () => {
  const found = findYamlRegion("context: >\n  text\n", ID);

  assert.equal(found.kind, "damaged");
});

test("a region inside the scalar is found with its parameters", () => {
  const file = ["context: |", OPEN, `  ${BODY[0]}`, CLOSE, ""].join("\n");

  const found = findYamlRegion(file, ID);

  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;
  assert.deepEqual(found.params, PARAMS);
});

// --- writing when the key is absent ---------------------------------------

test("the context key is created when the file does not have one", () => {
  const after = yamlWithRegion("name: demo\n", ID, PARAMS, BODY);

  assert.equal(after.kind, "ok");
  if (after.kind !== "ok") return;
  assert.equal(
    after.content,
    ["name: demo", "", "context: |", OPEN, `  ${BODY[0]}`, CLOSE, ""].join("\n")
  );
});

test("the key is created in an empty file without a leading blank line", () => {
  const after = yamlWithRegion(null, ID, PARAMS, BODY);

  assert.equal(after.kind, "ok");
  if (after.kind !== "ok") return;
  assert.equal(
    after.content,
    ["context: |", OPEN, `  ${BODY[0]}`, CLOSE, ""].join("\n")
  );
});

test("an unsupported scalar refuses the write instead of guessing", () => {
  const before = "context: >\n  folded text\n";

  const after = yamlWithRegion(before, ID, PARAMS, BODY);

  assert.equal(after.kind, "unsafe");
  if (after.kind !== "unsafe") return;
  assert.match(after.reason, /folded/);
});

test("damaged delimiters inside the scalar refuse the write", () => {
  const before = ["context: |", OPEN, "  text", ""].join("\n");

  const after = yamlWithRegion(before, ID, PARAMS, BODY);

  assert.equal(after.kind, "unsafe");
  if (after.kind !== "unsafe") return;
  assert.match(after.reason, /closing marker/);
});

// --- writing beside what the user owns ------------------------------------

const COMMENTED_FILE = [
  "# The project's OpenSpec configuration.",
  "",
  "name: demo   # the display name",
  "",
  "# context: |",
  "#   Anything every artifact should know.",
  "",
  "schema: spec-driven",
  "",
].join("\n");

testCovering(
  "every comment in the configuration file survives the edit",
  "artifact-language",
  ["Comments survive the edit"],
  () => {
    const after = yamlWithRegion(COMMENTED_FILE, ID, PARAMS, BODY);

    assert.equal(after.kind, "ok");
    if (after.kind !== "ok") return;

    const comments = COMMENTED_FILE.split("\n").filter((l) =>
      l.trimStart().startsWith("#")
    );
    assert.ok(comments.length > 0);
    for (const comment of comments) {
      assert.ok(
        after.content.split("\n").includes(comment),
        `comment survives: ${comment}`
      );
    }
  }
);

testCovering(
  "the other keys, their values and their order are unchanged",
  "artifact-language",
  ["Other configuration is untouched"],
  () => {
    const after = yamlWithRegion(COMMENTED_FILE, ID, PARAMS, BODY);

    assert.equal(after.kind, "ok");
    if (after.kind !== "ok") return;

    const keysOf = (text: string): string[] =>
      text.split("\n").filter((l) => /^[a-z]/.test(l));

    // The trailing-comment on `name` and the exact spacing come through too:
    // these are compared as whole lines, not as parsed values.
    assert.deepEqual(keysOf(COMMENTED_FILE), [
      "name: demo   # the display name",
      "schema: spec-driven",
    ]);
    assert.deepEqual(keysOf(after.content), [
      "name: demo   # the display name",
      "schema: spec-driven",
      "context: |",
    ]);
  }
);

const USER_CONTEXT = [
  "name: demo",
  "",
  "context: |",
  "  This project ships a CLI.",
  "  Prefer small commits.",
  "",
  "schema: spec-driven",
  "",
].join("\n");

testCovering(
  "text the user wrote in the context field is kept, and the directive joins it",
  "artifact-language",
  ["The user's own context is preserved"],
  () => {
    const after = yamlWithRegion(USER_CONTEXT, ID, PARAMS, BODY);

    assert.equal(after.kind, "ok");
    if (after.kind !== "ok") return;

    const out = after.content.split("\n");
    assert.ok(out.includes("  This project ships a CLI."));
    assert.ok(out.includes("  Prefer small commits."));
    // Added alongside, after their text, rather than in place of it.
    assert.ok(
      out.indexOf(OPEN) > out.indexOf("  Prefer small commits."),
      "the region follows the user's own context"
    );
    assert.ok(out.includes("schema: spec-driven"));
  }
);

testCovering(
  "provisioning over an existing region replaces it, leaving exactly one",
  "artifact-language",
  ["A directive is never added twice", "Exactly one directive remains"],
  () => {
    const first = yamlWithRegion(USER_CONTEXT, ID, { lang: "en" }, ["English."]);
    assert.equal(first.kind, "ok");
    if (first.kind !== "ok") return;

    const second = yamlWithRegion(first.content, ID, PARAMS, BODY);
    assert.equal(second.kind, "ok");
    if (second.kind !== "ok") return;

    const opens = second.content
      .split("\n")
      .filter((l) => l.includes(`opsx-tools:${ID}`) && !l.includes(":end"));
    const closes = second.content
      .split("\n")
      .filter((l) => l.includes(`opsx-tools:${ID}:end`));

    assert.equal(opens.length, 1);
    assert.equal(closes.length, 1);
    assert.ok(second.content.includes("lang=pt-BR"));
    assert.ok(!second.content.includes("lang=en"));
    assert.ok(!second.content.includes("English."));
    // And the user's own context is still there, untouched by the replacement.
    assert.ok(second.content.includes("  This project ships a CLI."));
  }
);

test("a second write with the same input is a no-op", () => {
  const once = yamlWithRegion(USER_CONTEXT, ID, PARAMS, BODY);
  assert.equal(once.kind, "ok");
  if (once.kind !== "ok") return;

  const twice = yamlWithRegion(once.content, ID, PARAMS, BODY);
  assert.equal(twice.kind, "ok");
  if (twice.kind !== "ok") return;

  assert.equal(twice.content, once.content);
});

test("the scalar's own indent is used rather than the default one", () => {
  const deep = ["context: |", "    Their text.", ""].join("\n");

  const after = yamlWithRegion(deep, ID, PARAMS, BODY);

  assert.equal(after.kind, "ok");
  if (after.kind !== "ok") return;
  assert.ok(after.content.includes(`    # opsx-tools:${ID} lang=pt-BR`));
});

// --- removing -------------------------------------------------------------

testCovering(
  "removing the region leaves the user's own context and the key intact",
  "artifact-language",
  ["Removal leaves the user's own text"],
  () => {
    const written = yamlWithRegion(USER_CONTEXT, ID, PARAMS, BODY);
    assert.equal(written.kind, "ok");
    if (written.kind !== "ok") return;

    const removed = yamlWithRegion(written.content, ID, PARAMS, null);
    assert.equal(removed.kind, "ok");
    if (removed.kind !== "ok") return;

    assert.ok(removed.content.includes("context: |"));
    assert.ok(removed.content.includes("  This project ships a CLI."));
    assert.ok(removed.content.includes("  Prefer small commits."));
    assert.ok(!removed.content.includes("opsx-tools:"));
    assert.ok(!removed.content.includes(BODY[0]));
  }
);

testCovering(
  "removing the region takes the key with it when nothing else held it",
  "artifact-language",
  ["Removal takes the empty field with it"],
  () => {
    const before = ["name: demo", "", "schema: spec-driven", ""].join("\n");
    const written = yamlWithRegion(before, ID, PARAMS, BODY);
    assert.equal(written.kind, "ok");
    if (written.kind !== "ok") return;
    assert.ok(written.content.includes("context: |"));

    const removed = yamlWithRegion(written.content, ID, PARAMS, null);
    assert.equal(removed.kind, "ok");
    if (removed.kind !== "ok") return;

    // No `context: |` standing over nothing, and the file is back as it was.
    assert.ok(!removed.content.includes("context:"));
    assert.equal(removed.content, before);
  }
);

testCovering(
  "every other key, comment and blank line survives the removal",
  "artifact-language",
  ["The rest of the file survives removal"],
  () => {
    const written = yamlWithRegion(COMMENTED_FILE, ID, PARAMS, BODY);
    assert.equal(written.kind, "ok");
    if (written.kind !== "ok") return;

    const removed = yamlWithRegion(written.content, ID, PARAMS, null);
    assert.equal(removed.kind, "ok");
    if (removed.kind !== "ok") return;

    assert.equal(removed.content, COMMENTED_FILE);
  }
);

test("the key removal closes the gap rather than leaving a double blank", () => {
  const before = ["name: demo", "", "schema: spec-driven", ""].join("\n");
  const written = yamlWithRegion(before, ID, PARAMS, BODY);
  assert.equal(written.kind, "ok");
  if (written.kind !== "ok") return;

  const removed = yamlWithRegion(written.content, ID, PARAMS, null);
  assert.equal(removed.kind, "ok");
  if (removed.kind !== "ok") return;

  assert.ok(!removed.content.includes("\n\n\n"));
});

test("removing a region that was never there changes nothing", () => {
  assert.deepEqual(yamlWithRegion(USER_CONTEXT, ID, PARAMS, null), {
    kind: "ok",
    content: USER_CONTEXT,
  });
  assert.deepEqual(yamlWithRegion(null, ID, PARAMS, null), {
    kind: "ok",
    content: "",
  });
});

test("a region another component owns keeps the key alive after this one leaves", () => {
  const other = ["  # opsx-tools:other", "  Theirs.", "  # opsx-tools:other:end"];
  const before = ["context: |", ...other, ""].join("\n");

  const written = yamlWithRegion(before, ID, PARAMS, BODY);
  assert.equal(written.kind, "ok");
  if (written.kind !== "ok") return;

  const removed = yamlWithRegion(written.content, ID, PARAMS, null);
  assert.equal(removed.kind, "ok");
  if (removed.kind !== "ok") return;

  assert.equal(removed.content, before);
  assert.ok(removed.content.includes("context: |"));
});
