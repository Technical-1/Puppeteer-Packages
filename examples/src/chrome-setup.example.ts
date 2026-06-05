/**
 * @technical-1/chrome-setup — ensureChrome / resolveChromePath demo
 *
 * Demonstrates resolving a pre-installed Chrome binary and falling back to
 * downloading one via ensureChrome. Pure Node — no puppeteer types needed.
 *
 * These calls are typecheck-only (not executed in CI).
 */

import {
  DEFAULT_CHROME_BUILD,
  resolveChromePath,
  ensureChrome,
} from "@technical-1/chrome-setup";
import type {
  ResolveChromeOptions,
  EnsureChromeOptions,
  PlatformName,
} from "@technical-1/chrome-setup";
import { createConsoleLogger } from "@technical-1/logger";

const logger = createConsoleLogger({ minLevel: "info" });

// ── PlatformName — re-exported Plan 10 surface ────────────────────────────────
// Useful for callers that need to branch on the current OS.
const platform: PlatformName = "darwin";
console.log("target platform:", platform);

// ── Synchronous resolution ────────────────────────────────────────────────────
// Probe two custom directories before falling back to the default cache.
const resolveOpts: ResolveChromeOptions = {
  searchDirs: ["/opt/chrome-local", "/usr/local/bin"],
};

const existing = resolveChromePath(resolveOpts);
console.log("resolved path (or undefined):", existing);
// => e.g. /opt/chrome-local/chrome/linux-144.0.7559.96/chrome-linux64/chrome

// ── ensureChrome: resolve first, then download on cache miss ─────────────────
// Demonstrates both the default (latest stable) and an explicit pinned build.
const ensureOpts: EnsureChromeOptions = {
  searchDirs: ["/opt/chrome-local"],
  buildId: DEFAULT_CHROME_BUILD,
  logger,
};

export async function demo(): Promise<void> {
  // Default: install/locate latest stable Chrome.
  const latest = await ensureChrome();
  console.log("latest stable Chrome:", latest);

  // Explicit pin: use DEFAULT_CHROME_BUILD (the pinned stable revision).
  const pinned = await ensureChrome(ensureOpts);
  console.log("pinned Chrome executable:", pinned);
  // => /home/user/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome
}
