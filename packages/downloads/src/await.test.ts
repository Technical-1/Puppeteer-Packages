import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { awaitDownloadForTesting as awaitDownload } from "./await.js";

describe("awaitDownload", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves with the new file when one appears after the trigger", async () => {
    let listing: string[] = ["existing.txt"];
    const trigger = vi.fn(() => {
      // Simulate Chrome creating a .crdownload then renaming after a tick
      setTimeout(() => { listing = ["existing.txt", "report.pdf.crdownload"]; }, 50);
      setTimeout(() => { listing = ["existing.txt", "report.pdf"]; }, 150);
      return Promise.resolve();
    });

    const p = awaitDownload("/dl", trigger, {
      pollMs: 50,
      timeoutMs: 1000,
      readdir: async () => [...listing],
      stat: async () => ({ size: 1234 } as never),
    });

    await vi.runAllTimersAsync();
    const file = await p;

    expect(file.filename).toBe("report.pdf");
    expect(file.path).toBe("/dl/report.pdf");
    expect(file.size).toBe(1234);
    expect(trigger).toHaveBeenCalledOnce();
  });

  it("ignores .crdownload files until they rename", async () => {
    let listing: string[] = [];
    const trigger = vi.fn(async () => {
      listing = ["pending.zip.crdownload"];
    });

    const p = awaitDownload("/dl", trigger, {
      pollMs: 50,
      timeoutMs: 200,
      readdir: async () => [...listing],
      stat: async () => ({ size: 1 } as never),
    });

    const a = expect(p).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
    });
    await vi.runAllTimersAsync();
    await a;
  });

  it("rejects with PptrKitError(retryable:true) on timeout", async () => {
    const trigger = vi.fn(async () => undefined);

    const p = awaitDownload("/dl", trigger, {
      pollMs: 50,
      timeoutMs: 150,
      readdir: async () => [],
      stat: async () => ({ size: 0 } as never),
    });

    const a = expect(p).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
    });
    await vi.runAllTimersAsync();
    await a;
  });

  it("snapshots dir BEFORE trigger so prior files are ignored", async () => {
    let listing: string[] = ["leftover.zip"];
    const trigger = vi.fn(async () => {
      listing = ["leftover.zip", "new.zip"];
    });

    const p = awaitDownload("/dl", trigger, {
      pollMs: 50,
      timeoutMs: 1000,
      readdir: async () => [...listing],
      stat: async () => ({ size: 99 } as never),
    });

    await vi.runAllTimersAsync();
    const file = await p;

    expect(file.filename).toBe("new.zip"); // NOT "leftover.zip"
  });
});
