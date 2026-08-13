import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";

/**
 * Builds a throwaway tree holding exactly `relPaths`, hands its root to `fn`,
 * and removes it afterwards. Fixtures are written by the test rather than
 * versioned so that each case states, in its own body, which artifacts it is
 * ordering - including shapes this repository does not happen to contain.
 *
 * The root is whatever the caller needs it to be: a change directory, a
 * changes directory holding several, or one holding an `archive/`.
 */
export async function withTree<T>(
  relPaths: string[],
  fn: (root: string) => Promise<T>
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "opsx-tools-test-"));
  try {
    for (const rel of relPaths) {
      const full = join(root, rel);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, `# ${rel}\n`, "utf-8");
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/**
 * The reading order as the page actually presents it: the "On this page" list,
 * which both `renderChange` and `renderFiles` build from the same sequence they
 * render the sections in.
 */
export function tocNames(html: string): string[] {
  const items = html.matchAll(/<a href="#(?:artifact|section)-\d+">([^<]+)<\/a>/g);
  return [...items].map((m) => m[1]);
}

/** The artifact names of a scanned change, in the order it presents them. */
export function names(artifacts: { name: string }[]): string[] {
  return artifacts.map((a) => a.name);
}
