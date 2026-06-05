/**
 * @technical-1/fingerprint — randomFingerprint / applyFingerprint demo
 *
 * Demonstrates generating a random browser fingerprint (UA, viewport, locale,
 * timezone) and applying it to a page before navigation.
 *
 * Injected `Page` pattern — typecheck-only, not executed in CI.
 */

import { randomFingerprint, applyFingerprint } from "@technical-1/fingerprint";
import type { Fingerprint } from "@technical-1/fingerprint";
import type { Page } from "puppeteer-core";

export async function demo(page: Page): Promise<void> {
  // ── Generate a random fingerprint ─────────────────────────────────────────
  // Pass a seeded random function for deterministic results in tests.
  // The function must return a float in [0, 1) — the same contract as Math.random().
  let seed = 0;
  const seededRand = () => {
    seed = (seed + 0.137) % 1;
    return seed;
  };

  const fp: Fingerprint = randomFingerprint(seededRand);
  console.log("userAgent:", fp.userAgent);
  console.log("viewport:", fp.viewport);
  console.log("locale:", fp.locale);
  console.log("timezoneId:", fp.timezoneId);

  // ── Apply the fingerprint to a page before navigation ─────────────────────
  // Sets UA (object form), viewport, timezone, and Accept-Language header.
  await applyFingerprint(page, fp);
  console.log("fingerprint applied");

  // ── Default random (no seed) ──────────────────────────────────────────────
  const defaultFp = randomFingerprint();
  console.log("random locale:", defaultFp.locale);
}
