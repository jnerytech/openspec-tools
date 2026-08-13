import type { ServerOptions } from "./types.js";
/**
 * Why a bind failed, in the user's words rather than Node's. Exported because
 * it is a pure mapping: the codes it names are not all reachable by actually
 * binding something, and the mapping is what has to be right.
 */
export declare function bindFailureReason(err: unknown): string;
/** A reader that is up: what it bound, and how to take it down again. */
export interface RunningReader {
    port: number;
    url: string;
    close(): Promise<void>;
}
export declare function startServer(opts: ServerOptions): Promise<RunningReader>;
//# sourceMappingURL=server.d.ts.map