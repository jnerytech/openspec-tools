/**
 * How this package stops.
 *
 * Every path that used to call `process.exit` throws one of these instead, and
 * exactly one place — `main.ts` — turns it back into an exit code. Two things
 * fall out of that. The obvious one is that a caller can decide what to do with
 * a failure instead of having the decision made for it. The one that matters
 * here is that a failing invocation becomes observable without generating a
 * process: a test can call the code and catch the refusal, in the same process
 * the coverage instrumentation is measuring.
 *
 * The behaviour on the outside is unchanged, and is meant to stay that way:
 * `cli-interface` specifies the exit codes and the order of the messages in 45
 * scenarios, all of them covered by tests that run the real binary. Those tests
 * are the reason this refactor is safe, and they are not touched by it.
 */
/**
 * A refusal that the process should report and end on. `message` and `details`
 * are already in the form they are printed in — the thrower knows how it wants
 * to read, and the top level only decides where it goes and what code follows.
 */
export declare class ExitError extends Error {
    readonly code: number;
    readonly details: string[];
    constructor(message: string, details?: string[], code?: number);
}
export declare function isExitError(err: unknown): err is ExitError;
//# sourceMappingURL=exit.d.ts.map