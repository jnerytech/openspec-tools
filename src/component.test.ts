import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeComponentState,
  editPath,
  lineDiff,
  renderPlan,
  type Edit,
  type PathEdit,
  type RegionEdit,
} from "./component.js";
import { testCovering } from "./test-fixture.js";

/**
 * What the user is shown before anything is written. A region splice is
 * contiguous, so the diff is derived by trimming the common prefix and suffix
 * rather than by a diff algorithm - which makes the terminating-newline case
 * the one thing that can go wrong, and the one asserted hardest here.
 */

const write = (path: string, note?: string): PathEdit => ({
  kind: "path",
  action: "write",
  path,
  ...(note === undefined ? {} : { note }),
});

const remove = (path: string, note?: string): PathEdit => ({
  kind: "path",
  action: "delete",
  path,
  ...(note === undefined ? {} : { note }),
});

const region = (
  path: string,
  before: string | null,
  after: string | null
): RegionEdit => ({ kind: "region", path, before, after });

// --- the line diff --------------------------------------------------------

test("a file's terminating newline is not counted as a line", () => {
  // "a\n" is one line, not two: left in, the empty tail shows up as a phantom
  // blank in every diff this package prints.
  assert.deepEqual(lineDiff("a\n", "a\nb\n"), { removed: [], added: ["b"] });
  assert.deepEqual(lineDiff("a\n", "a"), { removed: [], added: [] });
});

test("identical contents produce no diff", () => {
  assert.deepEqual(lineDiff("a\nb\n", "a\nb\n"), { removed: [], added: [] });
});

test("a new file is all additions and no removals", () => {
  assert.deepEqual(lineDiff(null, "a\nb\n"), { removed: [], added: ["a", "b"] });
  assert.deepEqual(lineDiff("", "a\n"), { removed: [], added: ["a"] });
});

test("a removed file is all removals and no additions", () => {
  assert.deepEqual(lineDiff("a\nb\n", null), { removed: ["a", "b"], added: [] });
});

test("nothing on either side is no diff at all", () => {
  assert.deepEqual(lineDiff(null, null), { removed: [], added: [] });
});

test("only the changed hunk is reported, not the whole file", () => {
  const before = "keep 1\nkeep 2\nold\nkeep 3\n";
  const after = "keep 1\nkeep 2\nnew\nkeep 3\n";

  assert.deepEqual(lineDiff(before, after), {
    removed: ["old"],
    added: ["new"],
  });
});

test("an insertion between unchanged lines removes nothing", () => {
  assert.deepEqual(lineDiff("a\nc\n", "a\nb\nc\n"), {
    removed: [],
    added: ["b"],
  });
});

test("a hunk growing and shrinking is reported on both sides", () => {
  assert.deepEqual(lineDiff("head\nx\ntail\n", "head\ny\nz\ntail\n"), {
    removed: ["x"],
    added: ["y", "z"],
  });
});

test("a repeated line does not confuse the common prefix and suffix", () => {
  assert.deepEqual(lineDiff("a\na\na\n", "a\nb\na\n"), {
    removed: ["a"],
    added: ["b"],
  });
});

// --- the rendered plan ----------------------------------------------------

testCovering(
  "a file that will be created is named by its path",
  "project-provisioning",
  ["New files are named by path"],
  () => {
    const rendered = renderPlan([write("/p/.claude/skills/review")]).join("\n");

    assert.match(rendered, /Will be written:/);
    assert.match(rendered, /\/p\/\.claude\/skills\/review/);
  }
);

testCovering(
  "a file that will be deleted is named by its path",
  "project-provisioning",
  ["Deletions are named by path"],
  () => {
    const rendered = renderPlan([remove("/p/.claude/skills/review")]).join("\n");

    assert.match(rendered, /Will be deleted:/);
    assert.match(rendered, /\/p\/\.claude\/skills\/review/);
  }
);

testCovering(
  "an edit inside a file that already exists is shown as a diff",
  "project-provisioning",
  ["An edit inside an existing file is shown as a diff"],
  () => {
    const before = "# Theirs\n\nTheir paragraph.\n";
    const after = "# Theirs\n\nTheir paragraph.\n\n<!-- ours -->\nours\n<!-- ours:end -->\n";

    const rendered = renderPlan([region("/p/CLAUDE.md", before, after)]);
    const text = rendered.join("\n");

    // The path, then only the lines that move - the user's own paragraph is
    // not reprinted, which is what makes the diff readable at all.
    assert.match(text, /\/p\/CLAUDE\.md/);
    assert.ok(rendered.some((l) => l === "  + <!-- ours -->"));
    assert.ok(rendered.some((l) => l === "  + ours"));
    assert.ok(!text.includes("+ Their paragraph."));
    assert.ok(!text.includes("- Their paragraph."));
  }
);

test("a region edit creating a file says so, and one removing it says so", () => {
  const created = renderPlan([region("/p/CLAUDE.md", null, "x\n")]).join("\n");
  const removed = renderPlan([region("/p/CLAUDE.md", "x\n", null)]).join("\n");

  assert.match(created, /\(new file\)/);
  assert.match(removed, /\(file removed\)/);
});

test("a note is shown beside the path it qualifies", () => {
  const rendered = renderPlan([
    write("/p/skills/review", "differs from the packaged copy"),
    remove("/p/skills/old", "locally edited"),
  ]).join("\n");

  assert.match(rendered, /\/p\/skills\/review\s+\(differs from the packaged copy\)/);
  assert.match(rendered, /\/p\/skills\/old\s+\(locally edited\)/);
});

test("writes, deletions and diffs each appear under their own heading", () => {
  const rendered = renderPlan([
    region("/p/CLAUDE.md", "a\n", "b\n"),
    write("/p/new"),
    remove("/p/gone"),
  ]).join("\n");

  // Grouped by kind rather than left in call order, so the plan reads as
  // "what appears / what disappears / what is edited".
  assert.ok(rendered.indexOf("Will be written:") < rendered.indexOf("Will be deleted:"));
  assert.ok(rendered.indexOf("Will be deleted:") < rendered.indexOf("/p/CLAUDE.md"));
});

test("an empty plan renders nothing at all", () => {
  assert.deepEqual(renderPlan([]), []);
});

test("every edit reports the path it acts on", () => {
  const edits: Edit[] = [write("/p/a"), remove("/p/b"), region("/p/c", null, "x")];

  assert.deepEqual(edits.map(editPath), ["/p/a", "/p/b", "/p/c"]);
});

// --- how a state reads ----------------------------------------------------

test("each component state describes itself in the terms the user acts on", () => {
  assert.equal(describeComponentState({ kind: "absent" }), "not set");
  assert.equal(
    describeComponentState({ kind: "provisioned", detail: "English" }),
    "English"
  );
  assert.match(
    describeComponentState({ kind: "differs", detail: "English" }),
    /^English — differs/
  );
  assert.match(
    describeComponentState({ kind: "unsafe", reason: "two markers" }),
    /cannot be edited safely \(two markers\)/
  );
});
