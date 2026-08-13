import { existsSync, readdirSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
/** A directory is only a skill if it carries the file that defines one. */
const SKILL_MANIFEST = "SKILL.md";
/**
 * The package root, found by walking up from this module rather than from the
 * working directory: a globally installed copy is run from wherever the user
 * happens to be standing, and its `skills/` is beside its own code, not beside
 * theirs. `dist/skill-source.js` and `src/skill-source.ts` both sit one level
 * below the root, so the same walk answers for both.
 */
function packageRoot() {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (;;) {
        if (existsSync(resolve(dir, "package.json")))
            return dir;
        const parent = dirname(dir);
        // No package.json anywhere above: fall back to the module's parent, which
        // is the layout this package actually ships.
        // Coverage reason: reaching this means walking from this module to the
        // filesystem root without meeting a package.json — impossible while the
        // package has one, which it must to be installed at all.
        /* node:coverage ignore next */
        if (parent === dir)
            return dirname(dirname(fileURLToPath(import.meta.url)));
        dir = parent;
    }
}
/** Absolute path of the `skills/` directory this package ships. */
export function packagedSkillsDir() {
    return resolve(packageRoot(), "skills");
}
/**
 * Every skill the package ships, by directory name — which is also the name
 * the AI tool turns into a `/command`. This list is closed: it is the only set
 * of names the installer will ever write or delete, which is what keeps an
 * unrelated skill sharing the destination directory out of reach.
 */
export function listPackagedSkills(
/** Overridden only by this repository's own tests. */
root = packagedSkillsDir()) {
    let entries;
    try {
        entries = readdirSync(root, { withFileTypes: true });
    }
    catch {
        return [];
    }
    return entries
        .filter((entry) => {
        const path = resolve(root, entry.name);
        if (!isDirectory(path))
            return false;
        return existsSync(resolve(path, SKILL_MANIFEST));
    })
        .map((entry) => ({ name: entry.name, path: resolve(root, entry.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
/** Follows symlinks, so a linked skill directory still counts as one. */
function isDirectory(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=skill-source.js.map