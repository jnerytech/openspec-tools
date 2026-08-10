import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";
import { resolveProject } from "./project.js";
/** Where an AI tool looks for skills, under either a project or a home. */
const SKILLS_SUBPATH = [".claude", "skills"];
/**
 * A skills directory that did not exist when the AI tool started is only
 * noticed once it restarts, so creating one is reported rather than done
 * silently — otherwise the install looks like it failed.
 */
export const RESTART_CAVEAT = "A skills directory that did not exist when your AI tool started is only " +
    "detected after the tool is restarted.";
function skillsDirUnder(root) {
    return resolve(root, ...SKILLS_SUBPATH);
}
/**
 * The two destinations, in the order they are offered. The project one is
 * resolved by the same rule the reader uses for its port, so "project" means
 * one thing across both commands and does not depend on which subdirectory
 * the command was run from.
 */
export function destinations(cwd = process.cwd()) {
    const project = resolveProject(cwd);
    return [
        {
            id: "project",
            label: `project (${project.name})`,
            skillsDir: skillsDirUnder(project.root),
        },
        {
            id: "user",
            label: "user",
            skillsDir: skillsDirUnder(homedir()),
        },
    ];
}
export function findDestination(id, cwd) {
    const found = destinations(cwd).find((dest) => dest.id === id);
    // The id type is closed, so this cannot happen; the throw keeps the return
    // type honest rather than pushing an `undefined` check onto every caller.
    if (!found)
        throw new Error(`Unknown destination: ${id}`);
    return found;
}
/**
 * Makes the destination writable, reporting whether it had to be created so
 * the caller can pair the news with the restart caveat.
 */
export function ensureSkillsDir(dest) {
    if (existsSync(dest.skillsDir))
        return { created: false };
    mkdirSync(dest.skillsDir, { recursive: true });
    return { created: true };
}
/** Absolute path a given skill occupies, or would occupy, at a destination. */
export function installedPath(dest, skillName) {
    return resolve(dest.skillsDir, skillName);
}
//# sourceMappingURL=skill-destinations.js.map