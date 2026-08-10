import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve } from "path";
import { installedPath } from "./skill-destinations.js";
/**
 * Every file under a directory, keyed by its path relative to that directory.
 * Comparison covers the whole tree rather than `SKILL.md` alone, because a
 * skill carries references and scripts beside it and a stale reference file is
 * as much of a difference as a stale instruction.
 */
function readTree(dir) {
    const files = new Map();
    const walk = (current, prefix) => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const abs = resolve(current, entry.name);
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            // stat, not the dirent: a symlinked file or directory is compared by
            // what it points at, which is what the AI tool will read.
            if (statSync(abs).isDirectory())
                walk(abs, rel);
            else
                files.set(rel, readFileSync(abs));
        }
    };
    walk(dir, "");
    return files;
}
function treesMatch(a, b) {
    if (a.size !== b.size)
        return false;
    for (const [rel, contents] of a) {
        const other = b.get(rel);
        if (!other || !contents.equals(other))
            return false;
    }
    return true;
}
/**
 * What is installed for one skill at one destination. Derived entirely from
 * disk — nothing is written at install time to be read back here, so this
 * cannot go stale and cannot miss a copy it did not place itself.
 *
 * A copy that differs may be the user's edit or an unrelated skill that shares
 * the name. Both are reported as differing: the consequence of overwriting or
 * deleting either is the same, so both earn the same confirmation.
 */
export function skillState(skill, dest) {
    const target = installedPath(dest, skill.name);
    if (!existsSync(target))
        return { kind: "absent" };
    try {
        if (!statSync(target).isDirectory()) {
            return { kind: "unreadable", reason: "not a directory" };
        }
        const installed = readTree(target);
        const packaged = readTree(skill.path);
        return treesMatch(installed, packaged)
            ? { kind: "identical" }
            : { kind: "differs" };
    }
    catch (err) {
        return { kind: "unreadable", reason: err.message };
    }
}
/** How a state reads in a listing, in the terms the user has to act on. */
export function describeState(state) {
    switch (state.kind) {
        case "absent":
            return "not installed";
        case "identical":
            return "installed";
        case "differs":
            return "installed, differs from the packaged copy";
        case "unreadable":
            return `present but unreadable (${state.reason})`;
    }
}
//# sourceMappingURL=skill-state.js.map