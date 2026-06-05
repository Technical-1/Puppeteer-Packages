import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { awaitDownloadForTesting as awaitDownload, awaitDownload as awaitDownloadPublic } from "./await.js";

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

  it("rejects with PptrKitError(retryable:false) when readdir throws during initial snapshot", async () => {
    const cause = new Error("ENOENT: no such file or directory");
    const trigger = vi.fn();

    await expect(
      awaitDownload("/nonexistent", trigger, {
        readdir: async () => { throw cause; },
        stat: async () => ({ size: 0 } as never),
        timeoutMs: 1000,
        pollMs: 50,
      }),
    ).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: false,
      cause: expect.objectContaining({ message: cause.message }),
    });
    // trigger should never have been called — failure was on pre-snapshot
    expect(trigger).not.toHaveBeenCalled();
  });

  it("rejects with PptrKitError(retryable:false) when triggerFn throws", async () => {
    const cause = new Error("click failed");

    await expect(
      awaitDownload("/dl", async () => { throw cause; }, {
        readdir: async () => [],
        stat: async () => ({ size: 0 } as never),
        timeoutMs: 1000,
        pollMs: 50,
      }),
    ).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: false,
      cause: expect.objectContaining({ message: "click failed" }),
    });
  });

  it("public awaitDownload wrapper delegates to awaitDownloadForTesting and resolves correctly", async () => {
    // Exercises lines 35-41 — the public surface that production consumers call.
    let listing: string[] = [];
    const trigger = vi.fn(async () => {
      listing = ["download.csv"];
    });

    // awaitDownloadPublic uses real readdir/stat — we must override via the
    // InternalAwaitDownloadOptions seam. The public signature only accepts
    // AwaitDownloadOptions, so we cast to access the internal seam.
    const p = (awaitDownloadPublic as typeof awaitDownload)("/dl", trigger, {
      pollMs: 50,
      timeoutMs: 1000,
      readdir: async () => [...listing],
      stat: async () => ({ size: 42 } as never),
    });

    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.filename).toBe("download.csv");
    expect(result.size).toBe(42);
  });

  it("uses built-in defaults for pollMs/timeoutMs/readdir/stat when opts is omitted", async () => {
    // Exercises the ?? branches on lines 56-59 (opts.pollMs ?? DEFAULT_POLL_MS etc.).
    // We call without providing opts at all; the real readdir will throw ENOENT on a
    // nonexistent path which lets us observe the error without spinning any timers.
    vi.useRealTimers();
    await expect(
      awaitDownload("/__nonexistent_path_for_test__", async () => {}),
    ).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: false,
    });
  });
});
