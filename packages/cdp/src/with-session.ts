import type { CdpSession, CdpSource, OpenCdpSessionOptions } from "./types.js";
import { openCdpSession } from "./session.js";

export interface WithCdpSessionOptions extends OpenCdpSessionOptions {}

/**
 * Open a CDP session from `source`, run `fn(session)`, and guarantee
 * `session.detach()` in a finally — the escape hatch that structurally avoids
 * a leaked, never-detached CDP handle.
 *
 * A detach failure during cleanup is logged at `warn` and swallowed so it can
 * never mask `fn`'s result or its thrown error (a cleanup detach failure almost
 * always means the target already closed — there is nothing left to leak).
 */
export async function withCdpSession<T>(
  source: CdpSource,
  fn: (session: CdpSession) => Promise<T> | T,
  opts: WithCdpSessionOptions = {},
): Promise<T> {
  const session = await openCdpSession(source, opts);
  try {
    return await fn(session);
  } finally {
    try {
      await session.detach();
    } catch (cleanupError) {
      const message =
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      opts.logger?.log(
        `cdp: session detach during cleanup failed: ${message}`,
        "warn",
      );
    }
  }
}
