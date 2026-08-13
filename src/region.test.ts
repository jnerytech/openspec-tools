import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findRegion,
  markdownFormat,
  renderClosePayload,
  renderOpenPayload,
  renderRegion,
  spliceRegion,
  yamlCommentFormat,
} from "./region.js";
import { testCovering } from "./test-fixture.js";

/**
 * The grammar every region edit rests on. Nothing here touches a disk: locating
 * and splicing are pure over an array of lines, which is what makes the
 * byte-for-byte promise the components make testable at all.
 */

const ID = "demo";

/** The delimiter pair as the package writes it, in one format. */
const open = (params: Record<string, string> = {}): string =>
  markdownFormat.wrap(renderOpenPayload(ID, params));
const close = (): string => markdownFormat.wrap(renderClosePayload(ID));

const USER_LINES = ["# Their heading", "", "Their paragraph."];

// --- locating -------------------------------------------------------------

test("no delimiter at all is absent, not damage", () => {
  assert.deepEqual(findRegion(USER_LINES, ID, markdownFormat), {
    kind: "absent",
  });
});

test("an empty file is absent", () => {
  assert.deepEqual(findRegion([], ID, markdownFormat), { kind: "absent" });
});

test("a well-formed pair is found with its bounds and body", () => {
  const lines = [...USER_LINES, open(), "inside", close(), "after"];

  const found = findRegion(lines, ID, markdownFormat);

  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;
  assert.equal(found.start, 3);
  assert.equal(found.end, 5);
  assert.deepEqual(found.body, ["inside"]);
});

test("an empty region is found, with an empty body", () => {
  const found = findRegion([open(), close()], ID, markdownFormat);

  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;
  assert.deepEqual(found.body, []);
});

test("another component's region is invisible to this one", () => {
  const lines = [
    markdownFormat.wrap(renderOpenPayload("other", {})),
    "not ours",
    markdownFormat.wrap(renderClosePayload("other")),
  ];

  assert.deepEqual(findRegion(lines, ID, markdownFormat), { kind: "absent" });
});

test("a line that resembles the region but is not a comment is not a delimiter", () => {
  // Recognition is by the delimiters alone, never by resemblance: prose that
  // quotes the marker must not be mistaken for one.
  const lines = [`opsx-tools:${ID}`, "text", `opsx-tools:${ID}:end`];

  assert.deepEqual(findRegion(lines, ID, markdownFormat), { kind: "absent" });
});

// --- damage ---------------------------------------------------------------

test("a duplicated pair is damage", () => {
  const lines = [open(), "a", close(), open(), "b", close()];

  const found = findRegion(lines, ID, markdownFormat);

  assert.equal(found.kind, "damaged");
  if (found.kind !== "damaged") return;
  assert.match(found.reason, /more than one/);
});

test("an opening marker with no closing one is damage", () => {
  const found = findRegion([open(), "a"], ID, markdownFormat);

  assert.equal(found.kind, "damaged");
  if (found.kind !== "damaged") return;
  assert.match(found.reason, /no closing marker/);
});

test("a closing marker with no opening one is damage", () => {
  const found = findRegion(["a", close()], ID, markdownFormat);

  assert.equal(found.kind, "damaged");
  if (found.kind !== "damaged") return;
  assert.match(found.reason, /no opening marker/);
});

test("a closing marker before the opening one is damage", () => {
  const found = findRegion([close(), "a", open()], ID, markdownFormat);

  assert.equal(found.kind, "damaged");
  if (found.kind !== "damaged") return;
  assert.match(found.reason, /before the opening/);
});

test("a second opening marker alone is damage, not a replacement target", () => {
  const found = findRegion([open(), "a", open(), "b", close()], ID, markdownFormat);

  assert.equal(found.kind, "damaged");
});

// --- the parameters written into the opening delimiter ---------------------

test("the parameters written into the opening delimiter are read back", () => {
  const lines = [open({ lang: "pt-BR", mode: "strict" }), "body", close()];

  const found = findRegion(lines, ID, markdownFormat);

  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;
  assert.deepEqual(found.params, { lang: "pt-BR", mode: "strict" });
});

test("a region written without parameters reads back as none", () => {
  const found = findRegion([open(), close()], ID, markdownFormat);

  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;
  assert.deepEqual(found.params, {});
});

test("a parameter value containing '=' keeps everything after the first one", () => {
  const found = findRegion(
    [open({ note: "a=b=c" }), close()],
    ID,
    markdownFormat
  );

  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;
  assert.deepEqual(found.params, { note: "a=b=c" });
});

// --- rendering ------------------------------------------------------------

testCovering(
  "the markdown delimiters are comments, so they do not render as text",
  "claude-workflow-directives",
  ["Delimiters do not render"],
  () => {
    const rendered = renderRegion(ID, {}, ["a directive"], markdownFormat);

    assert.equal(rendered[0], `<!-- opsx-tools:${ID} -->`);
    assert.equal(rendered[rendered.length - 1], `<!-- opsx-tools:${ID}:end -->`);
    // Every delimiter line is a Markdown comment, start to end.
    for (const line of [rendered[0], rendered[rendered.length - 1]]) {
      assert.match(line, /^<!--.*-->$/);
    }
  }
);

test("the yaml delimiters are hash-prefixed, which is literal inside a block scalar", () => {
  const rendered = renderRegion(ID, {}, ["a directive"], yamlCommentFormat);

  assert.equal(rendered[0], `# opsx-tools:${ID}`);
  assert.equal(rendered[rendered.length - 1], `# opsx-tools:${ID}:end`);
});

test("an indent reaches the delimiters and the content, but not blank lines", () => {
  const rendered = renderRegion(ID, {}, ["a", "", "b"], yamlCommentFormat, "  ");

  assert.deepEqual(rendered, [
    `  # opsx-tools:${ID}`,
    "  a",
    "",
    "  b",
    `  # opsx-tools:${ID}:end`,
  ]);
});

test("what renderRegion writes is what findRegion reads back", () => {
  const params = { lang: "en" };
  const body = ["one", "", "two"];

  const rendered = renderRegion(ID, params, body, markdownFormat);
  const found = findRegion(rendered, ID, markdownFormat);

  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;
  assert.deepEqual(found.params, params);
  assert.deepEqual(found.body, body);
});

// --- splicing -------------------------------------------------------------

test("replacing a region carries every line outside the delimiters through", () => {
  const before = ["above", "still above"];
  const after = ["below", "still below"];
  const lines = [...before, open(), "old", close(), ...after];

  const found = findRegion(lines, ID, markdownFormat);
  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;

  const spliced = spliceRegion(lines, found, ["new one", "new two"]);

  assert.deepEqual(spliced, [...before, "new one", "new two", ...after]);
});

test("excising a region takes only its own lines", () => {
  const before = ["above"];
  const after = ["below"];
  const lines = [...before, open(), "gone", close(), ...after];

  const found = findRegion(lines, ID, markdownFormat);
  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;

  assert.deepEqual(spliceRegion(lines, found, null), [...before, ...after]);
});

test("a splice at the very start and at the very end keeps the neighbours", () => {
  const atStart = [open(), "x", close(), "after"];
  const startFound = findRegion(atStart, ID, markdownFormat);
  assert.equal(startFound.kind, "found");
  if (startFound.kind !== "found") return;
  assert.deepEqual(spliceRegion(atStart, startFound, null), ["after"]);

  const atEnd = ["before", open(), "x", close()];
  const endFound = findRegion(atEnd, ID, markdownFormat);
  assert.equal(endFound.kind, "found");
  if (endFound.kind !== "found") return;
  assert.deepEqual(spliceRegion(atEnd, endFound, null), ["before"]);
});

test("replacing then excising returns the file to what it was", () => {
  const original = [...USER_LINES, "tail"];
  const withRegion = [
    ...USER_LINES,
    ...renderRegion(ID, {}, ["body"], markdownFormat),
    "tail",
  ];

  const found = findRegion(withRegion, ID, markdownFormat);
  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;

  assert.deepEqual(spliceRegion(withRegion, found, null), original);
});
