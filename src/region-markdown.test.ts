import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findMarkdownRegion,
  isBlank,
  markdownWithRegion,
  readFileOrNull,
} from "./region-markdown.js";
import { renderClosePayload, renderOpenPayload } from "./region.js";
import { testCovering, withTree } from "./test-fixture.js";

/**
 * Whole-file editing for the two Markdown files this package writes into:
 * `CLAUDE.md` and `.claude/rules/commit-convention.md`. Both promise the user's
 * own text comes through unchanged, so every case here asserts what survives,
 * not only what was written.
 */

const ID = "demo";
const BODY = ["A directive line.", "A second one."];

const OPEN = `<!-- opsx-tools:${ID} -->`;
const CLOSE = `<!-- opsx-tools:${ID}:end -->`;

const USER = "# Their notes\n\nA paragraph they wrote.\n";

/** The region as it appears once written, for asserting on whole contents. */
const region = (body: string[] = BODY): string =>
  [OPEN, ...body, CLOSE].join("\n");

// --- reading --------------------------------------------------------------

test("a missing file reads as null, and null is blank", async () => {
  await withTree([], async (root) => {
    assert.equal(readFileOrNull(`${root}/absent.md`), null);
  });
  assert.equal(isBlank(null), true);
  assert.equal(isBlank(""), true);
  assert.equal(isBlank("   \n\n"), true);
  assert.equal(isBlank("x"), false);
});

test("a missing file holds no region", () => {
  assert.deepEqual(findMarkdownRegion(null, ID), { kind: "absent" });
});

test("a blank file holds no region", () => {
  assert.deepEqual(findMarkdownRegion("", ID), { kind: "absent" });
  assert.deepEqual(findMarkdownRegion("\n\n", ID), { kind: "absent" });
});

test("damage in the file is reported through, not hidden", () => {
  const found = findMarkdownRegion(`${OPEN}\nno close\n`, ID);

  assert.equal(found.kind, "damaged");
});

// --- writing into a file that does not exist ------------------------------

test("a region written into a missing file is the whole file", () => {
  assert.equal(markdownWithRegion(null, ID, {}, BODY), `${region()}\n`);
});

test("a region written into a blank file does not inherit its blank lines", () => {
  assert.equal(markdownWithRegion("\n\n\n", ID, {}, BODY), `${region()}\n`);
});

test("the file always ends with exactly one newline", () => {
  for (const before of [null, "", "text", "text\n", "text\n\n\n"]) {
    const after = markdownWithRegion(before, ID, {}, BODY);
    assert.ok(after.endsWith("\n"));
    assert.ok(!after.endsWith("\n\n"));
  }
});

// --- writing beside content the user wrote --------------------------------

testCovering(
  "a new region is separated from the text already there, not mixed into it",
  "commit-convention-rule",
  ["Texto do usuário no mesmo arquivo é preservado"],
  () => {
    const after = markdownWithRegion(USER, ID, {}, BODY);

    // Byte for byte: the user's text is a prefix of the result.
    assert.ok(after.startsWith(USER));
    assert.equal(after, `${USER}\n${region()}\n`);
    // A blank line stands between their last line and the opening delimiter,
    // so the region reads as its own block.
    const lines = after.split("\n");
    assert.equal(lines[lines.indexOf(OPEN) - 1], "");
  }
);

testCovering(
  "content the user wrote survives a region being written into the file",
  "claude-workflow-directives",
  ["The user's own content survives"],
  () => {
    const withRegion = markdownWithRegion(USER, ID, {}, BODY);

    const userLines = USER.split("\n").filter((line) => line !== "");
    for (const line of userLines) {
      assert.ok(
        withRegion.includes(line),
        `the user's line "${line}" survives`
      );
    }
    assert.deepEqual(
      withRegion.split("\n").filter((l) => userLines.includes(l)),
      userLines
    );
  }
);

testCovering(
  "provisioning over an existing region replaces it, leaving exactly one",
  "claude-workflow-directives",
  ["A region is never added twice"],
  () => {
    const first = markdownWithRegion(USER, ID, {}, ["first"]);
    const second = markdownWithRegion(first, ID, {}, ["second"]);

    assert.equal(second.split("\n").filter((l) => l === OPEN).length, 1);
    assert.equal(second.split("\n").filter((l) => l === CLOSE).length, 1);
    assert.ok(second.includes("second"));
    assert.ok(!second.includes("first"));
    assert.ok(second.startsWith(USER));
  }
);

test("a region is replaced in place, not moved to the end", () => {
  const before = `${OPEN}\nold\n${CLOSE}\n\n${USER}`;

  const after = markdownWithRegion(before, ID, {}, ["new"]);

  assert.ok(after.startsWith(`${OPEN}\nnew\n${CLOSE}`));
  assert.ok(after.trimEnd().endsWith("A paragraph they wrote."));
});

test("the parameters recorded in the delimiter are the ones just written", () => {
  const after = markdownWithRegion(null, ID, { lang: "pt-BR" }, BODY);
  const found = findMarkdownRegion(after, ID);

  assert.equal(found.kind, "found");
  if (found.kind !== "found") return;
  assert.deepEqual(found.params, { lang: "pt-BR" });
});

// --- excising -------------------------------------------------------------

testCovering(
  "an excised region takes only its own lines",
  "claude-workflow-directives",
  ["Removal leaves the rest of the file"],
  () => {
    const before = `${USER}\n${region()}\n`;

    const after = markdownWithRegion(before, ID, {}, null);

    assert.equal(after, USER);
    assert.ok(!after.includes(OPEN));
    assert.ok(!after.includes(CLOSE));
    for (const line of BODY) assert.ok(!after.includes(line));
  }
);

test("excising the only content leaves the file empty rather than blank-filled", () => {
  assert.equal(markdownWithRegion(`${region()}\n`, ID, {}, null), "");
});

test("excising a region that is not there changes nothing", () => {
  assert.equal(markdownWithRegion(USER, ID, {}, null), USER);
});

test("excising from a missing file yields nothing, and does not invent a file", () => {
  assert.equal(markdownWithRegion(null, ID, {}, null), "");
});

test("text below the region survives its removal", () => {
  const before = `${USER}\n${region()}\n\nA closing line.\n`;

  const after = markdownWithRegion(before, ID, {}, null);

  assert.ok(after.startsWith(USER));
  assert.ok(after.includes("A closing line."));
  assert.ok(!after.includes(OPEN));
});

test("a region another component owns is left alone by this one's removal", () => {
  const otherOpen = `<!-- ${renderOpenPayload("other", {})} -->`;
  const otherClose = `<!-- ${renderClosePayload("other")} -->`;
  const before = `${otherOpen}\ntheirs\n${otherClose}\n\n${region()}\n`;

  const after = markdownWithRegion(before, ID, {}, null);

  assert.ok(after.includes(otherOpen));
  assert.ok(after.includes("theirs"));
  assert.ok(after.includes(otherClose));
  assert.ok(!after.includes(OPEN));
});
