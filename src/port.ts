/**
 * The range the reader chooses from. It starts at the port this tool used to
 * hardcode, so `--port 4242` still reproduces the old address exactly, and it
 * sits above the privileged range and clear of the ephemeral ports the kernel
 * hands out — an automatic choice cannot be stolen by an outbound socket.
 */
export const PORT_RANGE_START = 4242;
export const PORT_RANGE_END = 4999;
export const PORT_RANGE_SIZE = PORT_RANGE_END - PORT_RANGE_START + 1;

/**
 * FNV-1a, 32-bit, over the UTF-8 bytes of the path. No dependency, and stable
 * across machines and Node versions — which matters the moment a user writes
 * the resulting URL down.
 */
export function fnv1a32(input: string): number {
  const bytes = Buffer.from(input, "utf8");
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The port a project prefers: a pure function of its root, stored nowhere. */
export function derivePort(identityPath: string): number {
  return PORT_RANGE_START + (fnv1a32(identityPath) % PORT_RANGE_SIZE);
}
