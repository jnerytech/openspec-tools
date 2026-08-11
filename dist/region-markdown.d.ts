import { type RegionLookup, type RegionParams } from "./region.js";
export declare function readFileOrNull(path: string): string | null;
export declare function isBlank(content: string | null): boolean;
export declare function findMarkdownRegion(content: string | null, id: string): RegionLookup;
/**
 * The file's whole content with the region written, replaced, or excised —
 * `body` of null excises it. Everything the user wrote is carried through: a
 * new region is appended after their content rather than placed among it, and
 * an excised one takes only its own lines.
 */
export declare function markdownWithRegion(content: string | null, id: string, params: RegionParams, body: string[] | null): string;
//# sourceMappingURL=region-markdown.d.ts.map