import { describe, it, expect, vi } from "vitest";
import type { CDPSession, Page } from "puppeteer-core";
import { withCdpSession } from "./with-session.js";

function cdpMock(over: Partial<Record<"send" | "on" | "off" | "detach", unknown>> = {}) {
  return {
    send: over.send ?? vi.fn().mockResolvedValue(undefined),
    on: over.on ?? vi.fn(),
    off: over.off ?? vi.fn(),
    detach: over.detach ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as CDPSession;
}
function sourceMock(cdp: CDPSession): Page {
  return { createCDPSession: vi.fn().mockResolvedValue(cdp) } as unknown as Page;
}

describe("withCdpSession", () => {
  it("passes a session to fn, returns fn's result, and detaches after", async () => {
    const detach = vi.fn().mockResolvedValue(undefined);
    const cdp = cdpMock({ detach });
    const seen: unknown[] = [];

    const result = await withCdpSession(sourceMock(cdp), async (session) => {
      seen.push(session.raw);
      return await session.send("Browser.getVersion");
    });

    expect(seen).toEqual([cdp]);
    expect(detach).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  it("detaches even when fn throws, and rethrows fn's error (not detach)", async () => {
    const detach = vi.fn().mockResolvedValue(undefined);
    const boom = new Error("fn failed");

    const err = await withCdpSession(sourceMock(cdpMock({ detach })), () => {
      throw boom;
    }).catch((e: unknown) => e);

    expect(err).toBe(boom);
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it("swallows a cleanup detach failure, logs a warning, and preserves fn's result", async () => {
    const detach = vi.fn().mockRejectedValue(new Error("target already closed"));
    const log = vi.fn();

    const result = await withCdpSession(
      sourceMock(cdpMock({ detach })),
      () => 42,
      { logger: { log } },
    );

    expect(result).toBe(42);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("cdp: session detach during cleanup failed"),
      "warn",
    );
  });

  it("does not run fn if the session cannot be opened", async () => {
    const source = {
      createCDPSession: vi.fn().mockRejectedValue(new Error("no target")),
    } as unknown as Page;
    const fn = vi.fn();

    const err = await withCdpSession(source, fn).catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe("CdpError");
    expect(fn).not.toHaveBeenCalled();
  });
});
