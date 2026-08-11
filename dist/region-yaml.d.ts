import { type RegionLookup, type RegionParams } from "./region.js";
/**
 * Where the live `context` key is, if there is one. A commented-out example is
 * not a key: the file `openspec init` leaves behind documents `context` in
 * comments and defines nothing, which is the common starting state and the one
 * a naive scan gets wrong, because the file *looks* like it has the key.
 *
 * Anchored at column zero, which is also what keeps a `context:` nested inside
 * some other mapping from being mistaken for the top-level one.
 */
export type ContextLocation = {
    kind: "absent";
} | {
    kind: "block";
    keyLine: number;
    bodyStart: number;
    /** Exclusive. */
    bodyEnd: number;
    indent: string;
} | {
    kind: "unsupported";
    reason: string;
};
export declare function locateContext(lines: string[]): ContextLocation;
export type YamlEdit = {
    kind: "ok";
    content: string;
} | {
    kind: "unsafe";
    reason: string;
};
export declare function findYamlRegion(content: string | null, id: string): RegionLookup;
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
export declare function yamlWithRegion(content: string | null, id: string, params: RegionParams, body: string[] | null): YamlEdit;
//# sourceMappingURL=region-yaml.d.ts.map