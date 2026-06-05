/**
 * @technical-1/human — humanDelay / humanType / humanMouseMove demo
 *
 * Demonstrates human-like timing helpers: randomized delay between actions,
 * per-keystroke typing rhythm, and linear mouse movement.
 *
 * Injected `Page` pattern — typecheck-only, not executed in CI.
 */

import { humanDelay, humanType, humanMouseMove } from "@technical-1/human";
import type {
  DelayOptions,
  TypeOptions,
  MousePoint,
  MouseMoveOptions,
} from "@technical-1/human";
import type { Page } from "puppeteer-core";

export async function demo(page: Page): Promise<void> {
  // ── Randomized pause between actions ──────────────────────────────────────
  const delayOpts: DelayOptions = { minMs: 100, maxMs: 500 };
  await humanDelay(delayOpts);
  console.log("waited human-like delay");

  // ── Type text with per-keystroke delay ────────────────────────────────────
  const typeOpts: TypeOptions = { minKeyMs: 50, maxKeyMs: 180 };
  await humanType(page, "input#search", "puppeteer scraping", typeOpts);
  console.log("typed with human rhythm");

  // ── Move mouse along a linear path in 15 steps ───────────────────────────
  const from: MousePoint = { x: 100, y: 200 };
  const to: MousePoint = { x: 400, y: 350 };
  const moveOpts: MouseMoveOptions = { steps: 15 };
  await humanMouseMove(page, from, to, moveOpts);
  console.log("mouse moved from", from, "to", to);
}
