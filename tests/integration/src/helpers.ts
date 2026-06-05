import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { ensureChrome } from "@technical-1/chrome-setup";
import { startServer } from "./server.js";
import type { FixtureServer } from "./server.js";

export interface FixtureBrowserCtx {
  browser: Browser;
  server: FixtureServer;
  executablePath: string;
}

/**
 * Launches Chrome via `ensureChrome`, starts the fixture HTTP server, and
 * opens a Puppeteer browser. Call this in `beforeAll` for integration suites
 * that need real-Chrome + fixture server.
 */
export async function launchFixtureBrowser(): Promise<FixtureBrowserCtx> {
  const executablePath = await ensureChrome();
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return { browser, server, executablePath };
}

/**
 * Tears down a browser + server context created by `launchFixtureBrowser`.
 * Each close is guarded independently so a failure in one does not skip the
 * other, preventing resource leaks.
 */
export async function teardownFixtureBrowser(ctx: {
  browser?: Browser;
  server?: FixtureServer;
}): Promise<void> {
  if (ctx.browser) {
    try {
      await ctx.browser.close();
    } catch {
      // ignore — server still needs to close
    }
  }
  if (ctx.server) {
    try {
      await ctx.server.close();
    } catch {
      // ignore
    }
  }
}
