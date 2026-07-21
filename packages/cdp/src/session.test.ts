import { describe, it, expect, vi } from "vitest";
import type { CDPSession, Page } from "puppeteer-core";
import { openCdpSession } from "./session.js";

/** A vi.fn()-backed CDPSession stub. */
function cdpMock(over: Partial<Record<"send" | "on" | "off" | "detach", unknown>> = {}) {
  return {
    send: over.send ?? vi.fn().mockResolvedValue({ ok: true }),
    on: over.on ?? vi.fn(),
    off: over.off ?? vi.fn(),
    detach: over.detach ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as CDPSession;
}

/** A source (Page-shaped) whose createCDPSession resolves the given session. */
function sourceMock(cdp: CDPSession | Error): Page {
  const createCDPSession =
    cdp instanceof Error
      ? vi.fn().mockRejectedValue(cdp)
      : vi.fn().mockResolvedValue(cdp);
  return { createCDPSession } as unknown as Page;
}

describe("openCdpSession", () => {
  it("opens a session from the source and exposes the raw handle", async () => {
    const cdp = cdpMock();
    const source = sourceMock(cdp);
    const session = await openCdpSession(source);
    expect(source.createCDPSession).toHaveBeenCalledTimes(1);
    expect(session.raw).toBe(cdp);
    expect(session.detached).toBe(false);
  });

  it("logs a step line through the injected logger", async () => {
    const log = vi.fn();
    await openCdpSession(sourceMock(cdpMock()), { logger: { log } });
    expect(log).toHaveBeenCalledWith("cdp: session opened", "step");
  });

  it("wraps a createCDPSession failure as a retryable CdpError", async () => {
    const source = sourceMock(new Error("target closed"));
    const err = await openCdpSession(source).catch((e: unknown) => e);
    const e = err as { name: string; retryable: boolean; cause?: Error };
    expect(e.name).toBe("CdpError");
    expect(e.retryable).toBe(true);
    expect(e.cause?.message).toBe("target closed");
  });
});

describe("CdpSession.send", () => {
  it("delegates to raw.send and returns its result", async () => {
    const send = vi.fn().mockResolvedValue({ frameTree: 1 });
    const session = await openCdpSession(sourceMock(cdpMock({ send })));
    const result = await session.send("Page.getFrameTree");
    expect(send).toHaveBeenCalledWith("Page.getFrameTree", undefined, undefined);
    expect(result).toEqual({ frameTree: 1 });
  });

  it("forwards params to raw.send", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const session = await openCdpSession(sourceMock(cdpMock({ send })));
    await session.send("Emulation.setGeolocationOverride", {
      latitude: 1,
      longitude: 2,
      accuracy: 1,
    });
    expect(send).toHaveBeenCalledWith(
      "Emulation.setGeolocationOverride",
      { latitude: 1, longitude: 2, accuracy: 1 },
      undefined,
    );
  });

  it("wraps a send failure as a retryable CdpError carrying the method", async () => {
    const send = vi.fn().mockRejectedValue(new Error("session detached"));
    const session = await openCdpSession(sourceMock(cdpMock({ send })));
    const err = await session
      .send("Storage.clearDataForOrigin")
      .catch((e: unknown) => e);
    const e = err as {
      name: string;
      retryable: boolean;
      context: Record<string, unknown>;
      cause?: Error;
    };
    expect(e.name).toBe("CdpError");
    expect(e.retryable).toBe(true);
    expect(e.context).toEqual({ method: "Storage.clearDataForOrigin" });
    expect(e.cause?.message).toBe("session detached");
  });
});

describe("CdpSession.on", () => {
  it("delegates to raw.on and returns a disposer that calls raw.off once", async () => {
    const on = vi.fn();
    const off = vi.fn();
    const session = await openCdpSession(sourceMock(cdpMock({ on, off })));
    const handler = vi.fn();

    const dispose = session.on("Target.attachedToTarget", handler);
    expect(on).toHaveBeenCalledWith("Target.attachedToTarget", handler);

    dispose();
    dispose(); // idempotent
    expect(off).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledWith("Target.attachedToTarget", handler);
  });
});

describe("CdpSession.detach", () => {
  it("delegates to raw.detach, flips detached, and is idempotent", async () => {
    const detach = vi.fn().mockResolvedValue(undefined);
    const session = await openCdpSession(sourceMock(cdpMock({ detach })));

    expect(session.detached).toBe(false);
    await session.detach();
    await session.detach(); // no second raw call
    expect(detach).toHaveBeenCalledTimes(1);
    expect(session.detached).toBe(true);
  });

  it("wraps a detach failure as a terminal CdpError", async () => {
    const detach = vi.fn().mockRejectedValue(new Error("already gone"));
    const session = await openCdpSession(sourceMock(cdpMock({ detach })));

    const err = await session.detach().catch((e: unknown) => e);
    const e = err as { name: string; retryable: boolean; cause?: Error };
    expect(e.name).toBe("CdpError");
    expect(e.retryable).toBe(false);
    expect(e.cause?.message).toBe("already gone");
    // detached stays true so a retry does not re-hit the dead raw session
    expect(session.detached).toBe(true);
  });
});
