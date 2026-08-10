import type { Destination, PackagedSkill, SkillState } from "./types.js";
/**
 * What is installed for one skill at one destination. Derived entirely from
 * disk — nothing is written at install time to be read back here, so this
 * cannot go stale and cannot miss a copy it did not place itself.
 *
 * A copy that differs may be the user's edit or an unrelated skill that shares
 * the name. Both are reported as differing: the consequence of overwriting or
 * deleting either is the same, so both earn the same confirmation.
 */
export declare function skillState(skill: PackagedSkill, dest: Destination): SkillState;
/** How a state reads in a listing, in the terms the user has to act on. */
export declare function describeState(state: SkillState): string;
//# sourceMappingURL=skill-state.d.ts.map