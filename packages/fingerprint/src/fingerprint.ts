import type { Page } from "puppeteer-core";

export interface Fingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
];
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1280, height: 800 },
];
const LOCALES = ["en-US", "en-GB", "de-DE", "fr-FR"];
const TIMEZONES = [
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
];

const ACCEPT_LANGUAGE: Record<string, string> = {
  "en-US": "en-US,en;q=0.9",
  "en-GB": "en-GB,en;q=0.9",
  "de-DE": "de-DE,de;q=0.9,en;q=0.8",
  "fr-FR": "fr-FR,fr;q=0.9,en;q=0.8",
};

/** Random number source in [0, 1). Override for deterministic tests. */
export type RandomFn = () => number;

function pick<T>(pool: readonly T[], rand: RandomFn): T {
  if (pool.length === 0) throw new RangeError("pick: pool must not be empty");
  const idx = Math.floor(rand() * pool.length);
  return pool[Math.min(idx, pool.length - 1)] as T;
}

/**
 * Build a random fingerprint from curated pools (inject `rand` for tests).
 *
 * v1 limitation: UA / viewport / locale / timezone are picked independently,
 * so a combination can be geographically incoherent (e.g. a Windows UA with a
 * Europe/Berlin timezone and en-US locale).
 */
export function randomFingerprint(rand: RandomFn = Math.random): Fingerprint {
  return {
    userAgent: pick(USER_AGENTS, rand),
    viewport: pick(VIEWPORTS, rand),
    locale: pick(LOCALES, rand),
    timezoneId: pick(TIMEZONES, rand),
  };
}

/**
 * Apply a fingerprint to a page: UA (object form), viewport, timezone, and
 * the `Accept-Language` request header.
 *
 * v1 limitations: only the `Accept-Language` HTTP header is set — the in-page
 * `navigator.language`/`navigator.languages` are NOT overridden (a JS-level
 * fingerprinter could still read the launch locale).
 */
export async function applyFingerprint(
  page: Page,
  fp: Fingerprint,
): Promise<void> {
  // object form — the string overload is @deprecated in puppeteer-core 24.x
  await page.setUserAgent({ userAgent: fp.userAgent });
  await page.setViewport(fp.viewport);
  await page.emulateTimezone(fp.timezoneId);
  await page.setExtraHTTPHeaders({
    "Accept-Language": ACCEPT_LANGUAGE[fp.locale] ?? fp.locale,
  });
}
