import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { PptrKitError } from "@technical-1/core";

vi.mock("@puppeteer/browsers", () => ({
  Browser: { CHROME: "chrome" },
  detectBrowserPlatform: vi.fn(() => "mac_arm"),
  install: vi.fn(async () => ({ executablePath: "/downloaded/chrome" })),
  resolveBuildId: vi.fn(async () => "200.0.0.0"),
}));

import * as browsers from "@puppeteer/browsers";
import { resolveChromePath, downloadChrome, ensureChrome, DEFAULT_CHROME_BUILD } from "./chrome.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cs-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("resolveChromePath", () => {
  it("returns undefined when no Chrome binary is in the search dirs", () => {
    expect(resolveChromePath({ searchDirs: [dir] })).toBeUndefined();
  });

  it("finds a linux-style chrome binary nested in a search dir", () => {
    const nested = join(dir, "chrome", "linux-1");
    mkdirSync(nested, { recursive: true });
    const bin = join(nested, "chrome");
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o755);
    const found = resolveChromePath({ searchDirs: [dir], platform: "linux" });
    expect(found).toBe(bin);
  });

  it("descends into a macOS .app bundle to find the binary", () => {
    const macOS = join(dir, "Google Chrome for Testing.app", "Contents", "MacOS");
    mkdirSync(macOS, { recursive: true });
    const bin = join(macOS, "Google Chrome for Testing");
    writeFileSync(bin, "");
    expect(resolveChromePath({ searchDirs: [dir], platform: "darwin" })).toBe(bin);
  });

  it("returns a match from the FIRST search dir that has one", () => {
    const d1 = join(dir, "a");
    const d2 = join(dir, "b");
    mkdirSync(join(d1, "x"), { recursive: true });
    mkdirSync(join(d2, "y"), { recursive: true });
    writeFileSync(join(d1, "x", "chrome"), "");
    writeFileSync(join(d2, "y", "chrome"), "");
    expect(resolveChromePath({ searchDirs: [d1, d2], platform: "linux" })).toBe(
      join(d1, "x", "chrome"),
    );
  });

  it("skips a subdirectory that cannot be read (BFS catch+continue — lines 35-36)", () => {
    // Create a dir structure: <dir>/accessible/chrome (would be found)
    // and a sibling dir with no-read permission that sits in the BFS queue first
    // so that readdirSync throws on it, exercises the catch { continue } path.
    const unreadable = join(dir, "00-unreadable");
    const accessible = join(dir, "aa-accessible");
    mkdirSync(unreadable);
    mkdirSync(accessible);
    writeFileSync(join(accessible, "chrome"), "");
    // Remove read+execute bits so readdirSync throws EACCES.
    chmodSync(unreadable, 0o000);
    try {
      // The BFS will hit `unreadable` first (alphabetically sorted by readdirSync),
      // catch the EACCES, continue, then find chrome in `accessible`.
      const found = resolveChromePath({ searchDirs: [dir], platform: "linux" });
      expect(found).toBe(join(accessible, "chrome"));
    } finally {
      // Restore so rmSync in afterEach can clean up.
      chmodSync(unreadable, 0o755);
    }
  });

  it("uses defaultSearchDirs() when no searchDirs option is provided (lines 67-69)", () => {
    // Calling resolveChromePath() with no searchDirs exercises the defaultSearchDirs() branch.
    // Contract: returns either undefined (no Chrome found in the default dirs) or a path
    // that actually exists on disk — never a phantom string.
    const result = resolveChromePath({ platform: "linux" });
    if (result === undefined) {
      expect(result).toBeUndefined();
    } else {
      expect(existsSync(result)).toBe(true);
    }
  });
});

describe("downloadChrome", () => {
  it("delegates to @puppeteer/browsers.install and returns the executablePath", async () => {
    const res = await downloadChrome({ cacheDir: dir, buildId: "100.0.0.0" });
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ browser: "chrome", buildId: "100.0.0.0", cacheDir: dir }),
    );
    expect(res.executablePath).toBe("/downloaded/chrome");
  });

  it("logs step + success via the injected logger", async () => {
    const log = vi.fn();
    await downloadChrome({ cacheDir: dir, buildId: "1.0.0.0", logger: { log } });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Downloading Chrome"), "step");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Chrome ready"), "success");
  });

  it("throws a PptrKitError when platform cannot be detected", async () => {
    (browsers.detectBrowserPlatform as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      undefined,
    );
    await expect(downloadChrome({ cacheDir: dir })).rejects.toBeInstanceOf(PptrKitError);
  });

  it("wraps an install() failure as a RETRYABLE PptrKitError", async () => {
    (browsers.install as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ENETUNREACH"),
    );
    await expect(downloadChrome({ cacheDir: dir })).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
    });
  });

  it("resolves the latest stable build when no buildId is given", async () => {
    await downloadChrome({ cacheDir: dir });
    expect(browsers.resolveBuildId).toHaveBeenCalledWith("chrome", "mac_arm", "stable");
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: "200.0.0.0" }),
    );
  });

  it("logs the resolved stable build id via logger (line 104)", async () => {
    // Exercises the logger?.log call on line 104 (branch: logger present, id non-empty).
    const log = vi.fn();
    await downloadChrome({ cacheDir: dir, logger: { log } });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("200.0.0.0"), "step");
  });

  it("pins an explicit buildId without resolving stable", async () => {
    await downloadChrome({ cacheDir: dir, buildId: "123.0.0.0" });
    expect(browsers.resolveBuildId).not.toHaveBeenCalled();
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: "123.0.0.0" }),
    );
  });

  it("falls back to DEFAULT_CHROME_BUILD when stable resolution fails", async () => {
    (browsers.resolveBuildId as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("offline"),
    );
    await downloadChrome({ cacheDir: dir });
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: DEFAULT_CHROME_BUILD }),
    );
  });

  it("falls back to DEFAULT_CHROME_BUILD when stable resolution fails with a non-Error throw (line 107 String(err) branch)", async () => {
    // Exercises the `err instanceof Error ? err.message : String(err)` else-branch.
    (browsers.resolveBuildId as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      "plain string rejection",
    );
    await downloadChrome({ cacheDir: dir });
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: DEFAULT_CHROME_BUILD }),
    );
  });

  it("logs the fallback reason via logger when stable resolution throws (lines 107-108)", async () => {
    const log = vi.fn();
    (browsers.resolveBuildId as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network error"),
    );
    await downloadChrome({ cacheDir: dir, logger: { log } });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("network error"),
      "step",
    );
  });

  it("falls back to DEFAULT_CHROME_BUILD when stable resolution returns empty", async () => {
    (browsers.resolveBuildId as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce("");
    await downloadChrome({ cacheDir: dir });
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: DEFAULT_CHROME_BUILD }),
    );
  });

  it("logs the no-build fallback message via logger when stable resolution returns empty (line 98)", async () => {
    // Exercises `logger?.log(...)` on line 98 — logger is present AND resolveBuildId returns "".
    const log = vi.fn();
    (browsers.resolveBuildId as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce("");
    await downloadChrome({ cacheDir: dir, logger: { log } });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Stable Chrome resolution returned no build"),
      "step",
    );
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: DEFAULT_CHROME_BUILD }),
    );
  });

  it("uses the homedir default cacheDir when no cacheDir option is provided (line 136)", async () => {
    // Exercises the `opts.cacheDir ?? join(homedir(), '.cache', 'puppeteer')` default branch.
    await downloadChrome({ buildId: "100.0.0.0" });
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheDir: join(homedir(), ".cache", "puppeteer"),
      }),
    );
  });
});

describe("ensureChrome", () => {
  it("returns an already-resolved path without downloading", async () => {
    const nested = join(dir, "win-1");
    mkdirSync(nested, { recursive: true });
    const bin = join(nested, "chrome.exe");
    writeFileSync(bin, "x");
    const path = await ensureChrome({ searchDirs: [dir], platform: "win32" });
    expect(path).toBe(bin);
    expect(browsers.install).not.toHaveBeenCalled();
  });

  it("logs the resolved path via logger when an existing Chrome is found (line 158)", async () => {
    // Exercises `opts.logger?.log(...)` on line 158 — logger present, existing Chrome found.
    const nested = join(dir, "win-2");
    mkdirSync(nested, { recursive: true });
    const bin = join(nested, "chrome.exe");
    writeFileSync(bin, "x");
    const log = vi.fn();
    const path = await ensureChrome({ searchDirs: [dir], platform: "win32", logger: { log } });
    expect(path).toBe(bin);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(bin), "info");
  });

  it("downloads when nothing is resolvable, then returns the downloaded path", async () => {
    const path = await ensureChrome({ searchDirs: [dir], cacheDir: dir });
    expect(browsers.install).toHaveBeenCalled();
    expect(path).toBe("/downloaded/chrome");
  });

  it("throws a PptrKitError when resolve and download both yield nothing", async () => {
    (browsers.install as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ executablePath: "" });
    await expect(ensureChrome({ searchDirs: [dir], cacheDir: dir })).rejects.toBeInstanceOf(PptrKitError);
  });

});
