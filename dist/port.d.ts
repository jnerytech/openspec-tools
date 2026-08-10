/**
 * The range the reader chooses from. It starts at the port this tool used to
 * hardcode, so `--port 4242` still reproduces the old address exactly, and it
 * sits above the privileged range and clear of the ephemeral ports the kernel
 * hands out — an automatic choice cannot be stolen by an outbound socket.
 */
export declare const PORT_RANGE_START = 4242;
export declare const PORT_RANGE_END = 4999;
export declare const PORT_RANGE_SIZE: number;
/**
 * FNV-1a, 32-bit, over the UTF-8 bytes of the path. No dependency, and stable
 * across machines and Node versions — which matters the moment a user writes
 * the resulting URL down.
 */
export declare function fnv1a32(input: string): number;
/** The port a project prefers: a pure function of its root, stored nowhere. */
export declare function derivePort(identityPath: string): number;
//# sourceMappingURL=port.d.ts.map