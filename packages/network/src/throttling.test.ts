import { describe, it, expect, vi } from "vitest";
import type { CDPSession, Page } from "puppeteer-core";
import { setOffline, throttle, THROTTLE_PROFILES } from "./throttling.js";

function pageMock() {
  const send = vi.fn().mockResolvedValue(undefined);
  const session = { send } as unknown as CDPSession;
  const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
  const page = { target: () => target } as unknown as Page;
  return { page, send, target };
}

describe("throttle", () => {
  it("sends Network.emulateNetworkConditions with the profile", async () => {
    const { page, send } = pageMock();
    await throttle(page, THROTTLE_PROFILES.SLOW_3G);

    expect(send).toHaveBeenCalledWith(
      "Network.emulateNetworkConditions",
      THROTTLE_PROFILES.SLOW_3G,
    );
  });

  it("wraps CDP failures in PptrKitError (retryable:true)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("CDP closed"));
    const session = { send } as unknown as CDPSession;
    const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
    const page = { target: () => target } as unknown as Page;

    await expect(throttle(page, THROTTLE_PROFILES.FAST_3G)).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: expect.objectContaining({ message: "CDP closed" }),
    });
  });
});

describe("setOffline", () => {
  it("setOffline(page, true) sends the OFFLINE profile", async () => {
    const { page, send } = pageMock();
    await setOffline(page, true);

    expect(send).toHaveBeenCalledWith(
      "Network.emulateNetworkConditions",
      THROTTLE_PROFILES.OFFLINE,
    );
  });

  it("setOffline(page, false) sends the NO_THROTTLE profile (offline:false, throughput:-1)", async () => {
    const { page, send } = pageMock();
    await setOffline(page, false);

    expect(send).toHaveBeenCalledWith(
      "Network.emulateNetworkConditions",
      THROTTLE_PROFILES.NO_THROTTLE,
    );
  });
});

describe("THROTTLE_PROFILES", () => {
  it("exposes the canonical DevTools presets with the expected shape", () => {
    expect(THROTTLE_PROFILES.OFFLINE.offline).toBe(true);
    expect(THROTTLE_PROFILES.NO_THROTTLE.offline).toBe(false);
    expect(THROTTLE_PROFILES.NO_THROTTLE.downloadThroughput).toBe(-1);
    expect(THROTTLE_PROFILES.SLOW_3G.offline).toBe(false);
    expect(THROTTLE_PROFILES.FAST_3G.latency).toBeGreaterThan(0);
  });
});
