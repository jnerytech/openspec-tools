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
/** `<!-- opsx-tools:id k=v -->` — a real comment, invisible when rendered. */
export const markdownFormat = {
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
export const yamlCommentFormat = {
    wrap: (payload) => `# ${payload}`,
    unwrap: (line) => {
        const trimmed = line.trim();
        return trimmed.startsWith("#") ? trimmed.slice(1).trim() : null;
    },
};
export function renderOpenPayload(id, params) {
    const pairs = Object.entries(params).map(([key, value]) => `${key}=${value}`);
    return [`${PREFIX}${id}`, ...pairs].join(" ");
}
export function renderClosePayload(id) {
    return `${PREFIX}${id}${CLOSE_SUFFIX}`;
}
/** Parameters when the payload opens this component's region, else null. */
function parseOpenPayload(payload, id) {
    const [head, ...pairs] = payload.split(/\s+/);
    if (head !== `${PREFIX}${id}`)
        return null;
    const params = {};
    for (const pair of pairs) {
        const eq = pair.indexOf("=");
        if (eq > 0)
            params[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    return params;
}
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
export function findRegion(lines, id, format) {
    const opens = [];
    const closes = [];
    lines.forEach((line, index) => {
        const payload = format.unwrap(line);
        if (payload === null)
            return;
        if (parseOpenPayload(payload, id))
            opens.push(index);
        else if (payload === renderClosePayload(id))
            closes.push(index);
    });
    if (opens.length === 0 && closes.length === 0)
        return { kind: "absent" };
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
export function renderRegion(id, params, body, format, indent = "") {
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
export function spliceRegion(lines, found, replacement) {
    const before = lines.slice(0, found.start);
    const after = lines.slice(found.end + 1);
    return replacement === null
        ? [...before, ...after]
        : [...before, ...replacement, ...after];
}
//# sourceMappingURL=region.js.map