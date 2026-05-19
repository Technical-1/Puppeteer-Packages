import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PptrKitError } from "@technical-1/core";

vi.mock("@puppeteer/browsers", () => ({
  Browser: { CHROME: "chrome" },
  detectBrowserPlatform: vi.fn(() => "mac_arm"),
  install: vi.fn(async () => ({ executablePath: "/downloaded/chrome" })),
}));

import * as browsers from "@puppeteer/browsers";
import { resolveChromePath, downloadChrome, ensureChrome } from "./chrome.js";

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
});

describe("downloadChrome", () => {
  it("delegates to @puppeteer/browsers.install and returns the executablePath", async () => {
    const res = await downloadChrome({ cacheDir: dir, buildId: "100.0.0.0" });
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ browser: "chrome", buildId: "100.0.0.0", cacheDir: dir }),
    );
    expect(res.executablePath).toBe("/downloaded/chrome");
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
