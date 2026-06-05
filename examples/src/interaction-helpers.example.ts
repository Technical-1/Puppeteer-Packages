/**
 * @technical-1/interaction-helpers — safeClick / safeType / waitAndGet / scroll demo
 *
 * Demonstrates safe (wait-then-act) click/type helpers, text extraction, and
 * page scrolling. Injected `Page` pattern — typecheck-only, not executed in CI.
 */

import {
  safeClick,
  safeType,
  waitAndGet,
  scroll,
} from "@technical-1/interaction-helpers";
import type {
  InteractionOptions,
  TypeOptions,
} from "@technical-1/interaction-helpers";
import type { Page } from "puppeteer-core";
import { createConsoleLogger } from "@technical-1/logger";

const logger = createConsoleLogger({ minLevel: "info" });

export async function demo(page: Page): Promise<void> {
  const baseOpts: InteractionOptions = { timeout: 10_000, logger };

  // ── click the login button ────────────────────────────────────────────────
  await safeClick(page, "#login-btn", baseOpts);
  console.log("clicked #login-btn");

  // ── type into the email field with a keystroke delay ─────────────────────
  const typeOpts: TypeOptions = { ...baseOpts, delay: 30 };
  await safeType(page, "input[name='email']", "user@example.com", typeOpts);
  console.log("typed email");

  // ── read an element's text content ───────────────────────────────────────
  const heading = await waitAndGet(page, "h1", baseOpts);
  console.log("page heading:", heading);

  // ── scroll to bottom to trigger lazy-loaded content ──────────────────────
  await scroll(page, {}); // no `by` → jump to bottom
  console.log("scrolled to bottom");

  // ── scroll by a fixed pixel amount ───────────────────────────────────────
  await scroll(page, { by: 400 });
  console.log("scrolled by 400px");
}
