import type { Page } from "puppeteer-core";

// In-page global used inside the evaluateOnNewDocument callback (runs in
// Chromium, not Node). Declare only what the callback touches — not the DOM lib.
declare var navigator: { language: string; languages: readonly string[] };

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
interface GeoProfile {
  locale: string;
  timezoneId: string;
  acceptLanguage: string;
}

/** Region-coherent profiles: locale ↔ timezone ↔ Accept-Language. */
const PROFILES: readonly GeoProfile[] = [
  { locale: "en-US", timezoneId: "America/New_York", acceptLanguage: "en-US,en;q=0.9" },
  { locale: "en-GB", timezoneId: "Europe/London", acceptLanguage: "en-GB,en;q=0.9" },
  { locale: "de-DE", timezoneId: "Europe/Berlin", acceptLanguage: "de-DE,de;q=0.9,en;q=0.8" },
  { locale: "fr-FR", timezoneId: "Europe/Paris", acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8" },
];

const ACCEPT_LANGUAGE: Record<string, string> = Object.fromEntries(
  PROFILES.map((p) => [p.locale, p.acceptLanguage]),
);

/**
 * Turn an Accept-Language header into the ordered language list Chrome exposes
 * as `navigator.languages`: split on comma, drop the `;q=` weight, trim.
 * e.g. "de-DE,de;q=0.9,en;q=0.8" → ["de-DE","de","en"].
 */
function languagesFromAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((tok) => tok.split(";")[0]!.trim())
    .filter((t) => t.length > 0);
}

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
 * `locale` and `timezoneId` are drawn together from a region-coherent profile
 * (so the combination is geographically plausible); `userAgent` (OS-based) and
 * `viewport` (device-based) are drawn independently.
 */
export function randomFingerprint(rand: RandomFn = Math.random): Fingerprint {
  const profile = pick(PROFILES, rand);
  return {
    userAgent: pick(USER_AGENTS, rand),
    viewport: pick(VIEWPORTS, rand),
    locale: profile.locale,
    timezoneId: profile.timezoneId,
  };
}

/**
 * Rewrite the UA's `Chrome/<version>` token to match the live browser, so the
 * spoofed UA never disagrees with the real binary. Returns `ua` unchanged if
 * the browser version can't be read or parsed (never throws).
 */
async function reconcileUserAgent(page: Page, ua: string): Promise<string> {
  let raw: string;
  try {
    raw = await page.browser().version();
  } catch {
    return ua;
  }
  const version = raw.match(/Chrome\/([\d.]+)/)?.[1];
  if (!version) return ua;
  return ua.replace(/Chrome\/[\d.]+/, `Chrome/${version}`);
}

/**
 * Apply a fingerprint to a page: UA (object form, version reconciled to the
 * live browser), viewport, timezone, the `Accept-Language` request header, and
 * an in-page override of `navigator.language`/`navigator.languages`.
 * `navigator.languages` is derived from the same `Accept-Language` header's
 * token list (q-values stripped), so the in-page JS reads always agree with
 * the header — they can never disagree.
 *
 * The UA's `Chrome/<version>` token is rewritten to match `page.browser()
 * .version()` — so the spoofed UA tracks whatever Chrome is actually running
 * (system Chrome, a newer download, etc.). If the version can't be parsed the
 * generated UA is used unchanged (never throws).
 *
 * Notes: `setExtraHTTPHeaders` is full-replace — extra headers a caller set
 * before `applyFingerprint` are dropped; call this first, then layer your own.
 * The `navigator` override is registered via `evaluateOnNewDocument`, so it
 * applies on the next (and every subsequent) navigation in this page — call
 * `applyFingerprint` BEFORE navigating.
 */
export async function applyFingerprint(
  page: Page,
  fp: Fingerprint,
): Promise<void> {
  const userAgent = await reconcileUserAgent(page, fp.userAgent);
  // object form — the string overload is @deprecated in puppeteer-core 24.x
  await page.setUserAgent({ userAgent });
  await page.setViewport(fp.viewport);
  await page.emulateTimezone(fp.timezoneId);
  const profileAcceptLanguage = ACCEPT_LANGUAGE[fp.locale];
  const acceptLanguage = profileAcceptLanguage ?? fp.locale;
  await page.setExtraHTTPHeaders({ "Accept-Language": acceptLanguage });
  // For a pinned locale with a profile entry, navigator.languages is derived
  // from the header's token list so the two can never disagree. For a locale
  // outside the profiles (no Accept-Language entry), the header is just the
  // raw locale string (no commas) — so fall back to unioning in the primary
  // subtag directly, same as the old behavior, instead of collapsing to a
  // single-element list for hyphenated locales like "es-MX".
  const languages = profileAcceptLanguage
    ? languagesFromAcceptLanguage(profileAcceptLanguage)
    : [fp.locale, ...(fp.locale.includes("-") ? [fp.locale.split("-")[0]!] : [])];
  await page.evaluateOnNewDocument(
    (locale: string, langs: string[]) => {
      /* v8 ignore next 11 -- in-page evaluateOnNewDocument callback; covered by tests/integration fingerprint test */
      // configurable: true is intentional — allows re-application without
      // throwing, and mirrors Chromium's own navigator property descriptors.
      Object.defineProperty(navigator, "language", {
        get: () => locale,
        configurable: true,
      });
      Object.defineProperty(navigator, "languages", {
        get: () => Object.freeze([...langs]),
        configurable: true,
      });
    },
    fp.locale,
    languages,
  );
}
