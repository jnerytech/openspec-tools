/**
 * A delimited region this package owns inside a file it does not. The grammar
 * of the delimiters lives here and the comment syntax lives in the format, so
 * the two file types this package writes into differ by four lines rather than
 * by a second implementation.
 *
 * Delimiters carry the component's own parameters, which is what lets a state
 * report say *which* language is set rather than only that something is. The
 * record therefore lives in the file it describes and the two cannot drift.
 */

const PREFIX = "opsx-tools:";
const CLOSE_SUFFIX = ":end";

/** How a payload is framed as a comment in one file format. */
export interface RegionFormat {
  wrap(payload: string): string;
  /** The payload inside a comment, or null when the line is not one. */
  unwrap(line: string): string | null;
}

/** `<!-- opsx-tools:id k=v -->` — a real comment, invisible when rendered. */
export const markdownFormat: RegionFormat = {
  wrap: (payload) => `<!-- ${payload} -->`,
  unwrap: (line) => {
    const match = /^<!--\s*(.*?)\s*-->$/.exec(line.trim());
    return match ? match[1] : null;
  },
};

/**
 * `# opsx-tools:id k=v` — inside a YAML block scalar this is literal text, not
 * a comment, so it reaches the agent along with the directive. Two short lines,
 * accepted deliberately: a delimiter shaped to read as prose cannot be matched
 * reliably, which is the one thing a delimiter exists to do.
 */
export const yamlCommentFormat: RegionFormat = {
  wrap: (payload) => `# ${payload}`,
  unwrap: (line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("#") ? trimmed.slice(1).trim() : null;
  },
};

export type RegionParams = Record<string, string>;

/**
 * Pairs are separated by whitespace, so a value containing any would be read
 * back as two pairs and lose everything after the first word — which is what a
 * language named "Norsk bokmål" did. Only what breaks the format is escaped:
 * whitespace, and the escape character itself. Everything else, accents
 * included, stays as written, because this line is read by people in a file
 * they own.
 */
function encodeValue(value: string): string {
  return value.replace(/[%\s]/g, (char) =>
    char === "%"
      ? "%25"
      : `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
  );
}

/**
 * The inverse. A value written before this existed has no `%` in it and comes
 * back unchanged, so regions already in a user's file keep reading correctly.
 */
function decodeValue(value: string): string {
  return value.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

export function renderOpenPayload(id: string, params: RegionParams): string {
  const pairs = Object.entries(params).map(
    ([key, value]) => `${key}=${encodeValue(value)}`
  );
  return [`${PREFIX}${id}`, ...pairs].join(" ");
}

export function renderClosePayload(id: string): string {
  return `${PREFIX}${id}${CLOSE_SUFFIX}`;
}

/** Parameters when the payload opens this component's region, else null. */
function parseOpenPayload(payload: string, id: string): RegionParams | null {
  const [head, ...pairs] = payload.split(/\s+/);
  if (head !== `${PREFIX}${id}`) return null;

  const params: RegionParams = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq > 0) params[pair.slice(0, eq)] = decodeValue(pair.slice(eq + 1));
  }
  return params;
}

export type RegionLookup =
  | { kind: "absent" }
  | { kind: "found"; start: number; end: number; params: RegionParams; body: string[] }
  | { kind: "damaged"; reason: string };

/**
 * Where this component's region sits, matched by its delimiters alone. Nothing
 * is ever recognized by resembling what the package writes: an unrecognized
 * region is reported, never silently replaced, and never joined by a second
 * one because the first went unseen.
 *
 * Anything short of exactly one well-ordered pair is damage. Refusing is always
 * available and never destructive, which is why every ambiguous shape lands
 * here rather than in a repair heuristic.
 */
export function findRegion(
  lines: string[],
  id: string,
  format: RegionFormat
): RegionLookup {
  const opens: number[] = [];
  const closes: number[] = [];

  lines.forEach((line, index) => {
    const payload = format.unwrap(line);
    if (payload === null) return;
    if (parseOpenPayload(payload, id)) opens.push(index);
    else if (payload === renderClosePayload(id)) closes.push(index);
  });

  if (opens.length === 0 && closes.length === 0) return { kind: "absent" };
  if (opens.length > 1 || closes.length > 1) {
    return { kind: "damaged", reason: "more than one region marker is present" };
  }
  if (opens.length === 0) {
    return { kind: "damaged", reason: "a closing marker with no opening marker" };
  }
  if (closes.length === 0) {
    return { kind: "damaged", reason: "an opening marker with no closing marker" };
  }
  if (closes[0] < opens[0]) {
    return {
      kind: "damaged",
      reason: "the closing marker appears before the opening one",
    };
  }

  const start = opens[0];
  const end = closes[0];
  const payload = format.unwrap(lines[start]);
  return {
    kind: "found",
    start,
    end,
    params: (payload === null ? null : parseOpenPayload(payload, id)) ?? {},
    body: lines.slice(start + 1, end),
  };
}

/** The region as lines, delimiters included, each prefixed with `indent`. */
export function renderRegion(
  id: string,
  params: RegionParams,
  body: string[],
  format: RegionFormat,
  indent = ""
): string[] {
  return [
    indent + format.wrap(renderOpenPayload(id, params)),
    ...body.map((line) => (line ? indent + line : line)),
    indent + format.wrap(renderClosePayload(id)),
  ];
}

/**
 * Replaces the located region, or excises it when `replacement` is null.
 * Everything outside the delimiters is carried through untouched — that
 * guarantee is the whole reason this is line splicing rather than a parse and
 * a re-serialization.
 */
export function spliceRegion(
  lines: string[],
  found: { start: number; end: number },
  replacement: string[] | null
): string[] {
  const before = lines.slice(0, found.start);
  const after = lines.slice(found.end + 1);
  return replacement === null
    ? [...before, ...after]
    : [...before, ...replacement, ...after];
}
