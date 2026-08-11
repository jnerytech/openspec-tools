import type { Component } from "../component.js";
/**
 * Every component `init` offers, in the order it presents them: what the
 * package ships first, then what it configures. The list is closed and compiled
 * in — it exists to keep a second and third component cheap, not to accept one
 * from outside, which is what keeps `init` unable to write somewhere nobody
 * reviewed.
 */
export declare const COMPONENTS: Component<any>[];
export declare function componentById(id: string): Component<any> | undefined;
//# sourceMappingURL=index.d.ts.map