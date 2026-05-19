import { describe, it, expect, vi } from "vitest";
import { goto, waitForNetworkIdle } from "./navigation.js";
import type { Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    goto: vi.fn().mockResolvedValue(null),
    waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Page;
}

describe("goto", () => {
  it("calls page.goto with url + waitUntil + timeout", async () => {
    const page = mockPage();
    await goto(page, "https://x.test", { waitUntil: "domcontentloaded", timeout: 9000 });
    expect(page.goto).toHaveBeenCalledWith(
      "https://x.test",
      expect.objectContaining({ waitUntil: "domcontentloaded", timeout: 9000 }),
    );
  });

  it("retries a failing navigation then succeeds (no real wait)", async () => {
    const gotoMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("net::ERR_TIMED_OUT"))
      .mockResolvedValue(null);
    const page = mockPage({ goto: gotoMock });
    await goto(page, "https://x.test", {
      retry: { retries: 2, minDelayMs: 0, jitter: false },
    });
    expect(gotoMock).toHaveBeenCalledTimes(2);
  });

  it("wraps a terminal navigation failure in NavigationError (url + cause)", async () => {
    const cause = new Error("net::ERR_NAME_NOT_RESOLVED");
    const page = mockPage({ goto: vi.fn().mockRejectedValue(cause) });
    await expect(
      goto(page, "https://bad.test", {
        retry: { retries: 1, minDelayMs: 0, jitter: false },
      }),
    ).rejects.toMatchObject({ name: "NavigationError", url: "https://bad.test" });
  });
});

describe("waitForNetworkIdle", () => {
  it("delegates to page.waitForNetworkIdle with options", async () => {
    const page = mockPage();
    await waitForNetworkIdle(page, { idleTime: 600, timeout: 12000 });
    expect(page.waitForNetworkIdle).toHaveBeenCalledWith(
      expect.objectContaining({ idleTime: 600, timeout: 12000 }),
    );
  });
});
