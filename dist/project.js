import { existsSync, statSync, realpathSync } from "fs";
import { basename, dirname, resolve, sep } from "path";
/**
 * The one place a path becomes an identity: absolute, symlinks resolved,
 * trailing separator stripped. Everything downstream — the derived port and
 * the display name — reads this single value, so the same repository reached
 * two ways cannot become two projects.
 */
function normalize(path) {
    const abs = resolve(path);
    let real = abs;
    try {
        real = realpathSync(abs);
    }
    catch {
        // A path that cannot be resolved is still an identity; keep the absolute
        // form rather than failing before the server has said anything.
    }
    return real.length > 1 && real.endsWith(sep) ? real.slice(0, -1) : real;
}
function isDirectory(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
/** Nearest enclosing directory owning `marker`, walking up to the filesystem root. */
function findUp(start, owns) {
    let dir = start;
    for (;;) {
        if (owns(dir))
            return dir;
        const parent = dirname(dir);
        if (parent === dir)
            return undefined;
        dir = parent;
    }
}
/**
 * Which project the reader is serving, independent of the subdirectory the
 * command was run from. An `openspec/` owner wins over a repository root: a
 * repository may hold several specs directories, and the specs are what is
 * being read.
 */
export function resolveProject(cwd = process.cwd()) {
    const start = normalize(cwd);
    const openspecOwner = findUp(start, (dir) => isDirectory(resolve(dir, "openspec")));
    // Only asked when the first rule found nothing, so the walk is not paid for
    // twice and the answer still says which rule produced the root.
    const gitOwner = openspecOwner
        ? undefined
        // `.git` is a file in a linked worktree, so existence is the test.
        : findUp(start, (dir) => existsSync(resolve(dir, ".git")));
    const root = normalize(openspecOwner ?? gitOwner ?? start);
    const source = openspecOwner
        ? "openspec"
        : gitOwner
            ? "git"
            : "cwd";
    // The basename, not package.json's `name` — a name may be scoped, may not
    // exist, and is absent entirely when the target is a plain docs folder.
    return { root, name: basename(root) || root, source };
}
//# sourceMappingURL=project.js.map