import type { Destination, PackagedSkill, SkillState } from "./types.js";
/** One packaged skill at one destination, with what is there right now. */
export interface Assignment {
    skill: PackagedSkill;
    dest: Destination;
    path: string;
    state: SkillState;
}
/**
 * A yes/no question the caller answers however it likes — by prompting, or by
 * the option that waives prompting. Waiving changes only whether the user is
 * asked, never which paths are written or deleted, so both paths run this same
 * flow.
 */
export type Confirm = (message: string) => Promise<boolean>;
export declare const ALWAYS_YES: Confirm;
export declare function assign(skills: PackagedSkill[], dests: Destination[]): Assignment[];
/**
 * Installs each assignment, reporting every destination's outcome on its own
 * line. An identical copy is a no-op that is still reported — the user asked a
 * question and gets an answer either way — and is never a prompt.
 */
export declare function installAssignments(assignments: Assignment[], confirm: Confirm): Promise<void>;
/**
 * Names every directory it would delete before deleting any of them, so the
 * confirmation is over the whole set rather than one path at a time. A copy
 * with local modifications is called out inside that list: deleting it
 * discards work that exists nowhere else.
 */
export declare function removeAssignments(assignments: Assignment[], confirm: Confirm): Promise<boolean>;
/** Deletes what has already been named and confirmed, reporting each path. */
export declare function deleteAssignments(targets: Assignment[]): void;
//# sourceMappingURL=skill-actions.d.ts.map