import { Command } from "commander";
export declare const VERSION: string;
/**
 * The command tree, built but not run. Separated from `main.ts` so the same
 * tree can be driven by a caller that is not a process entry point — which is
 * what lets a test invoke a command and observe its refusal in the process the
 * coverage instrumentation is measuring, rather than only from outside.
 */
export declare function buildProgram(): Command;
//# sourceMappingURL=program.d.ts.map