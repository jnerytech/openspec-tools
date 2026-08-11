import { existsSync, readFileSync } from "fs";
import {
  findRegion,
  markdownFormat,
  renderRegion,
  spliceRegion,
  type RegionLookup,
  type RegionParams,
} from "./region.js";

export function readFileOrNull(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function isBlank(content: string | null): boolean {
  return content === null || content.trim() === "";
}

/** Collapses the blank-line runs a splice can leave, and ends with one newline. */
function tidy(lines: string[]): string {
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim() === "" && out.length > 0 && out[out.length - 1].trim() === "") {
      continue;
    }
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  return out.length === 0 ? "" : `${out.join("\n")}\n`;
}

export function findMarkdownRegion(
  content: string | null,
  id: string
): RegionLookup {
  if (content === null) return { kind: "absent" };
  return findRegion(content.split("\n"), id, markdownFormat);
}

/**
 * The file's whole content with the region written, replaced, or excised —
 * `body` of null excises it. Everything the user wrote is carried through: a
 * new region is appended after their content rather than placed among it, and
 * an excised one takes only its own lines.
 */
export function markdownWithRegion(
  content: string | null,
  id: string,
  params: RegionParams,
  body: string[] | null
): string {
  const lines = content === null ? [] : content.split("\n");
  const found = findRegion(lines, id, markdownFormat);
  const region =
    body === null ? null : renderRegion(id, params, body, markdownFormat);

  if (found.kind === "found") return tidy(spliceRegion(lines, found, region));
  if (region === null) return content ?? "";

  // Separated by a blank line from whatever was already there, so the region
  // reads as its own block rather than as a continuation of the last paragraph.
  const existing = isBlank(content) ? [] : [...lines, ""];
  return tidy([...existing, ...region]);
}
