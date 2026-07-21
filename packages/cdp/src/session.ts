import type { CDPEvents, CDPSession, CommandOptions } from "puppeteer-core";
import { CdpError } from "@technical-1/core";
import type { CdpSession, CdpSource, OpenCdpSessionOptions } from "./types.js";

/**
 * Open a raw Chrome DevTools Protocol session from a `Page` or `Target` and
 * return a thin, error-wrapped handle. Both `Page.createCDPSession()` and
 * `Target.createCDPSession()` return `Promise<CDPSession>`.
 *
 * Throws `CdpError` (`retryable:true` — the usual failure is a closed target
 * that succeeds against a fresh one) wrapping the underlying error as `cause`.
 */
export async function openCdpSession(
  source: CdpSource,
  opts: OpenCdpSessionOptions = {},
): Promise<CdpSession> {
  let raw: CDPSession;
  try {
    raw = await source.createCDPSession();
  } catch (cause) {
    throw new CdpError("cdp: failed to open CDP session", {
      retryable: true,
      cause,
    });
  }
  opts.logger?.log("cdp: session opened", "step");
  return wrap(raw);
}

function wrap(raw: CDPSession): CdpSession {
  let detached = false;

  // Re-implement send to wrap failures while preserving the exact typed
  // signature. The implementation is intentionally loosely typed (its
  // method/params correlation is enforced at the call site by the cast to
  // CDPSession["send"]); the single structural cast is unavoidable because a
  // wrapper returning Promise<unknown> is not otherwise assignable to the
  // generic per-method return type.
  const sendImpl = async (
    method: Parameters<CDPSession["send"]>[0],
    params?: unknown,
    options?: CommandOptions,
  ): Promise<unknown> => {
    try {
      return await raw.send(method, params as never, options);
    } catch (cause) {
      throw new CdpError(`cdp: command ${String(method)} failed`, {
        retryable: true,
        cause,
        context: { method },
      });
    }
  };
  const send = sendImpl as unknown as CDPSession["send"];

  const on = <K extends keyof CDPEvents>(
    event: K,
    handler: (payload: CDPEvents[K]) => void,
  ): (() => void) => {
    raw.on(event, handler);
    let off = false;
    return (): void => {
      if (off) return;
      off = true;
      raw.off(event, handler);
    };
  };

  const detach = async (): Promise<void> => {
    if (detached) return;
    detached = true;
    try {
      await raw.detach();
    } catch (cause) {
      throw new CdpError("cdp: failed to detach session", {
        retryable: false,
        cause,
      });
    }
  };

  return {
    raw,
    get detached(): boolean {
      return detached;
    },
    send,
    on,
    detach,
  };
}
