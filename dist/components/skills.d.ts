import type { Component } from "../component.js";
import type { Destination } from "../types.js";
/** Which destinations this provisioning writes to. */
export interface SkillsSelection {
    dests: Destination[];
}
/**
 * The skills the package ships, provisioned as one item. `init` answers "set
 * this repo up"; `opsx-tools skill` remains the surface for one skill at one
 * destination, so the checklist here stays one line however many skills ship.
 */
export declare const skillsComponent: Component<SkillsSelection>;
//# sourceMappingURL=skills.d.ts.map