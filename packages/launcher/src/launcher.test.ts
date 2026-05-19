import { describe, it, expect, vi } from "vitest";
import { launch, withBrowser } from "./launcher.js";

function mockPuppeteer() {
  const browser = { close: vi.fn().mockResolvedValue(undefined) };
  const puppeteer = { launch: vi.fn().mockResolvedValue(browser) };
  return { puppeteer, browser };
}

describe("launch", () => {
  it("passes executablePath, headless and merged sandbox args", async () => {
    const { puppeteer, browser } = mockPuppeteer();
    const result = await launch(puppeteer as never, {
      executablePath: "/c",
      headless: false,
      args: ["--foo"],
    });
    expect(result).toBe(browser);
    expect(puppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: "/c",
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--foo"],
      }),
    );
  });

  it("defaults to headless true", async () => {
    const { puppeteer } = mockPuppeteer();
    await launch(puppeteer as never, { executablePath: "/c" });
    expect(puppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({ headless: true }),
    );
  });
});

describe("withBrowser", () => {
  it("returns the callback result and closes the browser", async () => {
    const { puppeteer, browser } = mockPuppeteer();
    const out = await withBrowser(puppeteer as never, { executablePath: "/c" }, async () => "done");
    expect(out).toBe("done");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("closes the browser even when the callback throws, and rethrows", async () => {
    const { puppeteer, browser } = mockPuppeteer();
    const boom = new Error("boom");
    await expect(
      withBrowser(puppeteer as never, { executablePath: "/c" }, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("does not let a close() failure mask the callback error", async () => {
    const browser = { close: vi.fn().mockRejectedValue(new Error("close failed")) };
    const puppeteer = { launch: vi.fn().mockResolvedValue(browser) };
    const boom = new Error("automation boom");
    await expect(
      withBrowser(puppeteer as never, { executablePath: "/c" }, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("returns the result and logs (does not discard) when close() fails", async () => {
    const browser = { close: vi.fn().mockRejectedValue(new Error("close failed")) };
    const puppeteer = { launch: vi.fn().mockResolvedValue(browser) };
    const log = vi.fn();
    const out = await withBrowser(
      puppeteer as never,
      { executablePath: "/c", logger: { log } },
      async () => "ok",
    );
    expect(out).toBe("ok");
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("close failed"), "warn");
  });
});
