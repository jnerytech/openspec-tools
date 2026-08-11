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
/** How a payload is framed as a comment in one file format. */
export interface RegionFormat {
    wrap(payload: string): string;
    /** The payload inside a comment, or null when the line is not one. */
    unwrap(line: string): string | null;
}
/** `<!-- opsx-tools:id k=v -->` — a real comment, invisible when rendered. */
export declare const markdownFormat: RegionFormat;
/**
 * `# opsx-tools:id k=v` — inside a YAML block scalar this is literal text, not
 * a comment, so it reaches the agent along with the directive. Two short lines,
 * accepted deliberately: a delimiter shaped to read as prose cannot be matched
 * reliably, which is the one thing a delimiter exists to do.
 */
export declare const yamlCommentFormat: RegionFormat;
export type RegionParams = Record<string, string>;
export declare function renderOpenPayload(id: string, params: RegionParams): string;
export declare function renderClosePayload(id: string): string;
export type RegionLookup = {
    kind: "absent";
} | {
    kind: "found";
    start: number;
    end: number;
    params: RegionParams;
    body: string[];
} | {
    kind: "damaged";
    reason: string;
};
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
export declare function findRegion(lines: string[], id: string, format: RegionFormat): RegionLookup;
/** The region as lines, delimiters included, each prefixed with `indent`. */
export declare function renderRegion(id: string, params: RegionParams, body: string[], format: RegionFormat, indent?: string): string[];
/**
 * Replaces the located region, or excises it when `replacement` is null.
 * Everything outside the delimiters is carried through untouched — that
 * guarantee is the whole reason this is line splicing rather than a parse and
 * a re-serialization.
 */
export declare function spliceRegion(lines: string[], found: {
    start: number;
    end: number;
}, replacement: string[] | null): string[];
//# sourceMappingURL=region.d.ts.map