import type { PackagedSkill } from "./types.js";
/** Absolute path of the `skills/` directory this package ships. */
export declare function packagedSkillsDir(): string;
/**
 * Every skill the package ships, by directory name — which is also the name
 * the AI tool turns into a `/command`. This list is closed: it is the only set
 * of names the installer will ever write or delete, which is what keeps an
 * unrelated skill sharing the destination directory out of reach.
 */
export declare function listPackagedSkills(
/** Overridden only by this repository's own tests. */
root?: string): PackagedSkill[];
//# sourceMappingURL=skill-source.d.ts.map