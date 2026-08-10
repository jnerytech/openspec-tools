import type { Destination, DestinationId } from "./types.js";
/**
 * A skills directory that did not exist when the AI tool started is only
 * noticed once it restarts, so creating one is reported rather than done
 * silently — otherwise the install looks like it failed.
 */
export declare const RESTART_CAVEAT: string;
/**
 * The two destinations, in the order they are offered. The project one is
 * resolved by the same rule the reader uses for its port, so "project" means
 * one thing across both commands and does not depend on which subdirectory
 * the command was run from.
 */
export declare function destinations(cwd?: string): Destination[];
export declare function findDestination(id: DestinationId, cwd?: string): Destination;
/**
 * Makes the destination writable, reporting whether it had to be created so
 * the caller can pair the news with the restart caveat.
 */
export declare function ensureSkillsDir(dest: Destination): {
    created: boolean;
};
/** Absolute path a given skill occupies, or would occupy, at a destination. */
export declare function installedPath(dest: Destination, skillName: string): string;
//# sourceMappingURL=skill-destinations.d.ts.map