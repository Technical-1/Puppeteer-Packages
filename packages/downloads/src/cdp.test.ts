import { describe, it, expect, vi } from "vitest";
import type { Browser, CDPSession } from "puppeteer-core";
import { enableDownloads } from "./cdp.js";

function browserMock(): { browser: Browser; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn().mockResolvedValue(undefined);
  const session = { send } as unknown as CDPSession;
  const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
  const browser = { target: () => target } as unknown as Browser;
  return { browser, send };
}

describe("enableDownloads", () => {
  it("sends Browser.setDownloadBehavior with policy:allow + the dir", async () => {
    const { browser, send } = browserMock();
    await enableDownloads(browser, "/tmp/dl");

    expect(send).toHaveBeenCalledWith("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: "/tmp/dl",
      eventsEnabled: true,
    });
  });

  it("wraps CDP failures in DownloadError (retryable:true) with cause", async () => {
    const send = vi.fn().mockRejectedValue(new Error("CDP closed"));
    const session = { send } as unknown as CDPSession;
    const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
    const browser = { target: () => target } as unknown as Browser;

    await expect(enableDownloads(browser, "/tmp")).rejects.toMatchObject({
      name: "DownloadError",
      retryable: true,
      cause: expect.objectContaining({ message: "CDP closed" }),
    });
  });
});
