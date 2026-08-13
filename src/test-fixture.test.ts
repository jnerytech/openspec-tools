import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDeclaration, declaredHere, testCovering } from "./test-fixture.js";
import { readSpecScenarios } from "./gate/scenarios.js";

/**
 * The utility every other test in this repository leans on, checked against the
 * real specs rather than a fixture: what it has to be right about is the actual
 * `openspec/specs/` tree, and a fixture would only prove it right about a copy.
 */

const specs = readSpecScenarios();
const A_CAPABILITY = "artifact-ordering";
const A_TITLE = "A change carrying every artifact";

test("the fixture's own anchors are what the specs say they are", () => {
  assert.ok(specs.has(A_CAPABILITY));
  assert.ok(specs.get(A_CAPABILITY)?.includes(A_TITLE));
});

testCovering(
  "a title that is not in the spec throws, naming capability and title",
  "quality-gates",
  ["Um título inexistente derruba a execução", "Renomear um scenario quebra o teste que o cobria"],
  () => {
  assert.throws(
    () => checkDeclaration(A_CAPABILITY, ["No scenario is called this"]),
    (err: Error) => {
      assert.match(err.message, new RegExp(A_CAPABILITY));
      assert.match(err.message, /No scenario is called this/);
      return true;
    }
  );
});

test("one bad title among good ones still throws", () => {
  assert.throws(
    () => checkDeclaration(A_CAPABILITY, [A_TITLE, "Not a scenario"]),
    /Not a scenario/
  );
});

testCovering(
  "a capability that does not exist throws, naming it",
  "quality-gates",
  ["Um título inexistente derruba a execução"],
  () => {
  assert.throws(
    () => checkDeclaration("no-such-capability", [A_TITLE]),
    (err: Error) => {
      assert.match(err.message, /no-such-capability/);
      // The known capabilities are listed, so a typo is fixable from the
      // message rather than by going to look the directory up.
      assert.match(err.message, new RegExp(A_CAPABILITY));
      return true;
    }
  );
});

test("a title differing only in case or spacing is not accepted", () => {
  assert.throws(() => checkDeclaration(A_CAPABILITY, [A_TITLE.toLowerCase()]));
  assert.throws(() => checkDeclaration(A_CAPABILITY, [` ${A_TITLE}`]));
});

test("a valid pair does not throw", () => {
  assert.doesNotThrow(() => checkDeclaration(A_CAPABILITY, [A_TITLE]));
});

testCovering(
  "a valid pair is registered as covered",
  A_CAPABILITY,
  [A_TITLE],
  () => {
    const declared = declaredHere();
    assert.ok(
      declared.some((d) => d.capability === A_CAPABILITY && d.title === A_TITLE),
      "the pair the enclosing call declared is in this process's registry"
    );
  }
);

test("declaring the same pair twice registers it once", () => {
  const before = declaredHere().length;
  testCovering("a repeated declaration", A_CAPABILITY, [A_TITLE], () => {});
  assert.equal(declaredHere().length, before);
});
