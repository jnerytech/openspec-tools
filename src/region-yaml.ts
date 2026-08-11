import {
  findRegion,
  renderRegion,
  spliceRegion,
  yamlCommentFormat,
  type RegionLookup,
  type RegionParams,
} from "./region.js";

/** The key this package splices into, and the only one it touches. */
const KEY = "context";

const DEFAULT_INDENT = "  ";

/**
 * Where the live `context` key is, if there is one. A commented-out example is
 * not a key: the file `openspec init` leaves behind documents `context` in
 * comments and defines nothing, which is the common starting state and the one
 * a naive scan gets wrong, because the file *looks* like it has the key.
 *
 * Anchored at column zero, which is also what keeps a `context:` nested inside
 * some other mapping from being mistaken for the top-level one.
 */
export type ContextLocation =
  | { kind: "absent" }
  | {
      kind: "block";
      keyLine: number;
      bodyStart: number;
      /** Exclusive. */
      bodyEnd: number;
      indent: string;
    }
  | { kind: "unsupported"; reason: string };

function describeScalarHeader(header: string): string | null {
  const trimmed = header.trim();
  if (trimmed === "|") return null;
  if (trimmed === "") return "the key has no block scalar";
  if (trimmed.startsWith(">")) return "a folded scalar (>) is not spliceable";
  if (/^\|[-+0-9]/.test(trimmed)) {
    return `a block scalar with an indicator (${trimmed}) is not spliceable`;
  }
  return "the value is not a plain block scalar";
}

export function locateContext(lines: string[]): ContextLocation {
  const keyLine = lines.findIndex((line) =>
    new RegExp(`^${KEY}:`).test(line)
  );
  if (keyLine === -1) return { kind: "absent" };

  const header = lines[keyLine].slice(`${KEY}:`.length);
  const problem = describeScalarHeader(header);
  if (problem) return { kind: "unsupported", reason: problem };

  // The scalar runs until a line that is neither blank nor indented, which is
  // the next key at column zero or the end of the file.
  let bodyEnd = keyLine + 1;
  while (bodyEnd < lines.length) {
    const line = lines[bodyEnd];
    if (line.trim() !== "" && !/^\s/.test(line)) break;
    bodyEnd++;
  }

  // Blank lines trailing the scalar separate it from the next key and belong to
  // the file, not to the value. Leaving them inside would let an edit that
  // rewrites the scalar swallow the spacing the user put between their keys.
  while (bodyEnd > keyLine + 1 && lines[bodyEnd - 1].trim() === "") bodyEnd--;

  const firstContent = lines
    .slice(keyLine + 1, bodyEnd)
    .find((line) => line.trim() !== "");
  const indent = firstContent
    ? (/^\s*/.exec(firstContent)?.[0] ?? DEFAULT_INDENT)
    : DEFAULT_INDENT;

  return { kind: "block", keyLine, bodyStart: keyLine + 1, bodyEnd, indent };
}

export type YamlEdit =
  | { kind: "ok"; content: string }
  | { kind: "unsafe"; reason: string };

export function findYamlRegion(
  content: string | null,
  id: string
): RegionLookup {
  if (content === null) return { kind: "absent" };
  const lines = content.split("\n");
  const location = locateContext(lines);
  if (location.kind === "unsupported") {
    return { kind: "damaged", reason: location.reason };
  }
  if (location.kind === "absent") return { kind: "absent" };
  return findRegion(
    lines.slice(location.bodyStart, location.bodyEnd),
    id,
    yamlCommentFormat
  );
}

function trailingBlanksTrimmed(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  return out;
}

function joined(lines: string[]): string {
  const out = trailingBlanksTrimmed(lines);
  return out.length === 0 ? "" : `${out.join("\n")}\n`;
}

/**
 * The file's whole content with the region written, replaced, or excised —
 * `body` of null excises it. Only the region's own lines and, at most, the
 * `context` key that holds them are ever touched; every comment, every other
 * key, and the order of both survive, which is the entire reason this splices
 * lines instead of parsing and re-serializing.
 *
 * Excising the last content out of `context` takes the key with it: OpenSpec
 * treats a whitespace-only context as absent, so leaving an empty key behind
 * would be inert clutter in a file the user reads.
 */
export function yamlWithRegion(
  content: string | null,
  id: string,
  params: RegionParams,
  body: string[] | null
): YamlEdit {
  const lines = content === null ? [] : content.split("\n");
  const location = locateContext(lines);

  if (location.kind === "unsupported") {
    return { kind: "unsafe", reason: location.reason };
  }

  if (location.kind === "absent") {
    if (body === null) return { kind: "ok", content: content ?? "" };
    const region = renderRegion(
      id,
      params,
      body,
      yamlCommentFormat,
      DEFAULT_INDENT
    );
    const existing = trailingBlanksTrimmed(lines);
    return {
      kind: "ok",
      content: joined([
        ...existing,
        ...(existing.length > 0 ? [""] : []),
        `${KEY}: |`,
        ...region,
      ]),
    };
  }

  const scalar = lines.slice(location.bodyStart, location.bodyEnd);
  const found = findRegion(scalar, id, yamlCommentFormat);
  if (found.kind === "damaged") return { kind: "unsafe", reason: found.reason };

  const region =
    body === null
      ? null
      : renderRegion(id, params, body, yamlCommentFormat, location.indent);

  const nextScalar =
    found.kind === "found"
      ? spliceRegion(scalar, found, region)
      : region === null
      ? scalar
      : [...trailingBlanksTrimmed(scalar), ...region];

  const before = lines.slice(0, location.keyLine);
  const after = lines.slice(location.bodyEnd);

  // Nothing left in the scalar means the key is now inert; drop it rather than
  // leave `context: |` standing over nothing. The key took one blank line's
  // worth of separation with it, so give one back rather than leaving the gap
  // its two neighbours were never written with.
  if (trailingBlanksTrimmed(nextScalar).length === 0) {
    const gapClosed =
      before.length > 0 &&
      before[before.length - 1].trim() === "" &&
      after.length > 0 &&
      after[0].trim() === ""
        ? after.slice(1)
        : after;
    return { kind: "ok", content: joined([...before, ...gapClosed]) };
  }

  return {
    kind: "ok",
    content: joined([
      ...before,
      lines[location.keyLine],
      ...trailingBlanksTrimmed(nextScalar),
      ...after,
    ]),
  };
}
