/**
 * @technical-1/navigation — goto / waitForNetworkIdle demo
 *
 * Demonstrates navigating a page with retry/backoff and waiting for SPA
 * network idle. Injected `Page` pattern — typecheck-only, not executed in CI.
 */

import { goto, waitForNetworkIdle } from "@technical-1/navigation";
import type { GotoOptions, NetworkIdleOptions } from "@technical-1/navigation";
import type { Page } from "puppeteer-core";
import { createConsoleLogger } from "@technical-1/logger";

const logger = createConsoleLogger({ minLevel: "info" });

export async function demo(page: Page): Promise<void> {
  // ── goto with retry/backoff ────────────────────────────────────────────────
  const gotoOpts: GotoOptions = {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
    retry: { retries: 3, minDelayMs: 200, maxDelayMs: 2_000 },
    logger,
  };

  await goto(page, "https://example.com", gotoOpts);
  console.log("navigated to https://example.com");

  // ── waitForNetworkIdle — useful after SPA route transitions ───────────────
  const idleOpts: NetworkIdleOptions = {
    idleTime: 500,
    timeout: 15_000,
  };

  await waitForNetworkIdle(page, idleOpts);
  console.log("network idle");
}
