# Plan 10: Pre-1.0 Surface Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `@technical-1/*` public surface intentional before `1.0` by discharging the deferred decisions from Plans 01–09: `goto` returns the HTTP response, cross-package option-types are re-exported, `pdf` margins deep-merge, `fingerprint` UA tracks the live browser + overrides in-page locale + generates geo-coherent profiles, and `chrome-setup` installs the latest stable Chrome by default.

**Architecture:** Seven targeted changes across four packages (`navigation`, `chrome-setup`, `pdf`, `fingerprint`) — no new published packages, no `core` change. All keep the suite's conventions: DI-mockable browser (`import type` from `puppeteer-core`, inject `Page`/`Browser`, unit tests use plain object mocks), module-scoped `declare var` for in-page `evaluate*` callbacks (no DOM lib, no `as`), typed `core` errors, dual ESM+CJS, ≥1 unit test per change + a `PPTR_IT=1` integration test for browser-driving behavior.

**Tech Stack:** TypeScript NodeNext + strict + `verbatimModuleSyntax` + `noUncheckedIndexedAccess`, pnpm workspaces, Turborepo, Changesets, tsup, vitest, eslint flat config. New runtime API used: `@puppeteer/browsers` `resolveBuildId`. No new dependencies.

**Source spec:** `docs/superpowers/specs/2026-06-04-plan-10-surface-review-design.md`

---

## Conventions for this plan (read once)

- **Commits:** authored by the repo's configured allowlisted identity (`Technical-1 <51518860+Technical-1@users.noreply.github.com>`). Never pass `--author`, never set `GIT_*` env, never `--no-verify`. Commit messages describe the change only — NO `Co-Authored-By`, NO "Generated with Claude", no AI/assistant attribution anywhere.
- **Verification cadence per task:** after implementing, run the package's own tests, then `pnpm turbo run lint test build --output-logs=errors-only` before committing. Browser-driving changes also run `PPTR_IT=1 pnpm --filter @technical-1/integration-tests test` (real Chrome is expected available locally; if not, note it — CI's integration job covers it).
- **`noUncheckedIndexedAccess` is ON:** indexed/array/regex-group access yields `T | undefined`; guard with `?? …` or an explicit check. No `as any`, no `@ts-ignore`, no `as` casts in `src/`.
- **In-page `evaluate*` typing:** declare ONLY the in-page globals a callback uses via a module-scoped `declare var` at the top of the source file (NOT the DOM lib, NOT `@types`). Established by `interaction-helpers/src/helpers.ts`.

---

## File structure (what each task touches)

```
packages/navigation/src/navigation.ts        # Task 1: goto returns HTTPResponse | null
packages/navigation/src/navigation.test.ts    # Task 1
packages/navigation/src/index.ts             # Task 2: re-export RetryOptions
packages/navigation/src/index.test.ts         # Task 2
packages/chrome-setup/src/chrome.ts          # Task 2: export+tidy PlatformName; Task 6: stable resolution
packages/chrome-setup/src/index.ts           # Task 2: export PlatformName
packages/chrome-setup/src/index.test.ts       # Task 2
packages/chrome-setup/src/chrome.test.ts      # Task 6
packages/chrome-setup/README.md              # Task 6: document default=stable, buildId to pin
packages/pdf/src/pdf.ts                      # Task 3: per-side margin deep-merge
packages/pdf/src/pdf.test.ts                  # Task 3
packages/pdf/README.md                       # Task 3: document partial-margin semantics
packages/fingerprint/src/fingerprint.ts      # Task 4: UA reconcile + navigator.language; Task 5: geo profiles
packages/fingerprint/src/fingerprint.test.ts  # Tasks 4 & 5
tests/integration/src/fingerprint.integration.test.ts  # Task 4 (NEW): real-Chrome UA + locale
tests/integration/package.json               # Task 4: add @technical-1/fingerprint dep
.github/workflows/ci.yml                      # Task 6: Chrome cache key no longer pins 144
examples/src/navigation.example.ts           # Task 7: show goto's return + RetryOptions from navigation
examples/src/chrome-setup.example.ts         # Task 7: show stable default + explicit pin
.changeset/*.md                              # Task 8: one per touched package
```

---

## Task 1: `navigation.goto` returns `HTTPResponse | null`

**Files:**
- Modify: `packages/navigation/src/navigation.ts`
- Modify: `packages/navigation/src/navigation.test.ts`

Currently `goto` returns `Promise<void>` and discards the `HTTPResponse | null` from `page.goto` (`navigation.ts:46`). Capture and return it. Additive — existing callers ignore the return. The "4xx/5xx is not a navigation failure" contract is unchanged.

- [ ] **Step 1: Add the failing tests** to `packages/navigation/src/navigation.test.ts` (append inside the existing `describe("goto", …)` block):

```ts
  it("returns the HTTPResponse from page.goto", async () => {
    const response = { status: () => 200 };
    const page = mockPage({ goto: vi.fn().mockResolvedValue(response) });
    const result = await goto(page, "https://x.test");
    expect(result).toBe(response);
  });

  it("returns null when page.goto resolves null", async () => {
    const page = mockPage({ goto: vi.fn().mockResolvedValue(null) });
    const result = await goto(page, "https://x.test");
    expect(result).toBeNull();
  });
```

- [ ] **Step 2: Run → FAIL**

Run: `pnpm --filter @technical-1/navigation test`
Expected: the two new tests fail (`goto` currently returns `undefined`, not the response/null).

- [ ] **Step 3: Implement** — edit `packages/navigation/src/navigation.ts`:

Change the import on line 1 to add the type:
```ts
import type { Page, HTTPResponse } from "puppeteer-core";
```

Replace the `goto` JSDoc + signature + body (lines 21–58) with:
```ts
/**
 * Navigate `page` to `url` with retry/backoff. Returns the `HTTPResponse`
 * Puppeteer received (or `null` for same-document navigations / `about:blank`).
 *
 * Contract: "navigated" means `page.goto` did not network-error (DNS,
 * timeout, connection refused). An HTTP 4xx/5xx response does NOT fail
 * navigation — Puppeteer resolves on any received response. Gate on status
 * via the returned response: `const res = await goto(page, url); res?.status()`.
 *
 * A failure that survives all retries is rethrown as a `core`
 * `NavigationError` carrying the url + cause. That `NavigationError` has
 * `retryable: true`, so a caller wrapping `goto` in an OUTER retry policy
 * will re-attempt (outer × inner total attempts) — pass a terminal outer
 * policy if that is not desired.
 */
export async function goto(
  page: Page,
  url: string,
  opts: GotoOptions = {},
): Promise<HTTPResponse | null> {
  const waitUntil = opts.waitUntil ?? "load";
  const timeout = opts.timeout ?? 30000;
  opts.logger?.log(`navigating to ${url}`, "step");
  let response: HTTPResponse | null;
  try {
    response = await withRetry(
      async () => page.goto(url, { waitUntil, timeout }),
      {
        logger: opts.logger,
        isRetryable: () => true,
        ...opts.retry,
      },
    );
  } catch (err) {
    throw new NavigationError(url, { cause: err, context: { url, waitUntil } });
  }
  opts.logger?.log(`loaded ${url}`, "success");
  return response;
}
```

- [ ] **Step 4: Run → PASS**

Run: `pnpm --filter @technical-1/navigation test`
Expected: all navigation tests pass (the existing tests ignore the return value and still pass).

- [ ] **Step 5: Gate + commit**

Run: `pnpm turbo run lint test build --output-logs=errors-only` (expect green).
```bash
git add packages/navigation/src/navigation.ts packages/navigation/src/navigation.test.ts
git commit -m "feat(navigation): goto returns the HTTPResponse so callers can gate on HTTP status (P10T1)"
```

- [ ] **Step 6: Integration assertion** — edit `tests/integration/src/navigation.integration.test.ts`: in the happy-path `goto` test, capture and assert the response status. Add (inside the existing gated describe, happy-path test):

```ts
    const res = await goto(page, `${server.baseUrl}/`);
    expect(res?.status()).toBe(200);
```
(Adapt to the file's existing variable names — it already starts the server + browser in `beforeAll` and navigates in the happy-path test; replace the existing `await goto(...)` call with the capturing form above.)

Run: `PPTR_IT=1 pnpm --filter @technical-1/integration-tests test` → 15/15 (or current count) pass.
```bash
git add tests/integration/src/navigation.integration.test.ts
git commit -m "test(integration): assert navigation.goto returns a 200 response for the fixture (P10T1)"
```

---

## Task 2: Selective re-exports — `RetryOptions` + `PlatformName`

**Files:**
- Modify: `packages/navigation/src/index.ts`
- Modify: `packages/navigation/src/index.test.ts`
- Modify: `packages/chrome-setup/src/chrome.ts`
- Modify: `packages/chrome-setup/src/index.ts`
- Modify: `packages/chrome-setup/src/index.test.ts`

`RetryOptions` (reachable via `GotoOptions.retry`) isn't re-exported from `navigation`; `PlatformName` is a private, redundantly-defined type in `chrome-setup` used by `ResolveChromeOptions.platform`. Re-export both (additive). Tidy `PlatformName` to `NodeJS.Platform` (the extra literals are already members — same accepted values).

- [ ] **Step 1: Add the failing type-level tests.**

In `packages/navigation/src/index.test.ts`, add at the top-level (after existing imports):
```ts
import { expectTypeOf } from "vitest";
import type { RetryOptions } from "./index.js";

describe("navigation barrel re-exports", () => {
  it("re-exports RetryOptions (reachable via GotoOptions.retry)", () => {
    expectTypeOf<RetryOptions>().toHaveProperty("retries");
  });
});
```

In `packages/chrome-setup/src/index.test.ts`, add:
```ts
import { expectTypeOf } from "vitest";
import type { PlatformName } from "./index.js";

describe("chrome-setup barrel re-exports", () => {
  it("exports PlatformName equivalent to NodeJS.Platform", () => {
    expectTypeOf<PlatformName>().toEqualTypeOf<NodeJS.Platform>();
  });
});
```
(If either `index.test.ts` lacks a `describe`/import scaffold, add the standard `import { describe, it } from "vitest";` line.)

- [ ] **Step 2: Run → FAIL**

Run: `pnpm --filter @technical-1/navigation test && pnpm --filter @technical-1/chrome-setup test`
Expected: FAIL — `RetryOptions`/`PlatformName` are not exported from the respective barrels (TS resolution error at test compile).

- [ ] **Step 3: Implement.**

`packages/navigation/src/index.ts` — append:
```ts
export type { RetryOptions } from "@technical-1/retry";
```

`packages/chrome-setup/src/chrome.ts` — change line 14 from:
```ts
type PlatformName = NodeJS.Platform | "linux" | "darwin" | "win32";
```
to:
```ts
/** Node platform identifier (e.g. "darwin", "linux", "win32"). */
export type PlatformName = NodeJS.Platform;
```
(All existing internal uses of `PlatformName` keep working; accepted values are identical.)

`packages/chrome-setup/src/index.ts` — add `PlatformName` to the type re-export block:
```ts
export type {
  ResolveChromeOptions,
  DownloadChromeOptions,
  EnsureChromeOptions,
  PlatformName,
} from "./chrome.js";
```

- [ ] **Step 4: Run → PASS**

Run: `pnpm --filter @technical-1/navigation test && pnpm --filter @technical-1/chrome-setup test`
Expected: PASS. Also run `pnpm --filter @technical-1/navigation typecheck && pnpm --filter @technical-1/chrome-setup typecheck` → clean.

- [ ] **Step 5: Gate + commit**

Run: `pnpm turbo run lint test build --output-logs=errors-only` (green).
```bash
git add packages/navigation/src/index.ts packages/navigation/src/index.test.ts packages/chrome-setup/src/chrome.ts packages/chrome-setup/src/index.ts packages/chrome-setup/src/index.test.ts
git commit -m "feat(navigation,chrome-setup): re-export RetryOptions and PlatformName from their consumer barrels (P10T2)"
```

---

## Task 3: `pdf` per-side margin deep-merge

**Files:**
- Modify: `packages/pdf/src/pdf.ts`
- Modify: `packages/pdf/src/pdf.test.ts`
- Modify: `packages/pdf/README.md`

`pageToPdf` shallow-merges, so a partial `margin` drops the other sides' 1cm defaults. Deep-merge the margin sub-object.

- [ ] **Step 1: Add the failing test** to `packages/pdf/src/pdf.test.ts` (append inside `describe("pageToPdf", …)`):

```ts
  it("deep-merges a partial margin, keeping unspecified sides at the 1cm default", async () => {
    const page = pageMock();
    await pageToPdf(page, { margin: { top: "2cm" } });
    expect(page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        margin: { top: "2cm", bottom: "1cm", left: "1cm", right: "1cm" },
      }),
    );
  });
```

- [ ] **Step 2: Run → FAIL**

Run: `pnpm --filter @technical-1/pdf test`
Expected: FAIL — current shallow merge yields `margin: { top: "2cm" }` (other sides absent).

- [ ] **Step 3: Implement** — in `packages/pdf/src/pdf.ts`, replace the merge line (line 19) and the JSDoc:

```ts
/**
 * Render `page` to a PDF. Caller options shallow-merge over defensible
 * defaults (`A4`, `printBackground: true`, 1cm margins). The `margin` object
 * is DEEP-merged per side: a partial margin (e.g. `{ top: "2cm" }`) keeps the
 * unspecified sides at the 1cm default rather than dropping them to 0.
 *
 * Throws `PptrKitError` (`retryable:true`) wrapping puppeteer-core failures
 * as `cause`. Note: `page.pdf()` requires a headless Chrome — running
 * headful raises a runtime error that this wrapper does NOT rescue.
 */
export async function pageToPdf(page: Page, opts: PDFOptions = {}): Promise<Uint8Array> {
  const merged: PDFOptions = {
    ...DEFAULTS,
    ...opts,
    margin: { ...DEFAULTS.margin, ...opts.margin },
  };
  try {
    return await page.pdf(merged);
  } catch (cause) {
    throw new PptrKitError("pageToPdf failed", { retryable: true, cause });
  }
}
```

- [ ] **Step 4: Run → PASS**

Run: `pnpm --filter @technical-1/pdf test`
Expected: PASS (the new test + the two existing margin tests — which pass no `margin`, so they still get the full default object).

- [ ] **Step 5: Document the behavior change** — in `packages/pdf/README.md`, add/extend a note near the margin/usage section:

```markdown
### Margins

`pageToPdf` deep-merges the `margin` object per side over a 1cm default. A
partial margin keeps the unspecified sides at 1cm:

`pageToPdf(page, { margin: { top: "2cm" } })`
→ `{ top: "2cm", bottom: "1cm", left: "1cm", right: "1cm" }`

(Pass all four sides explicitly to override every margin.)
```

- [ ] **Step 6: Gate + commit**

Run: `pnpm turbo run lint test build --output-logs=errors-only` (green).
```bash
git add packages/pdf/src/pdf.ts packages/pdf/src/pdf.test.ts packages/pdf/README.md
git commit -m "feat(pdf): deep-merge margin per side so partial margins keep default sides (P10T3)"
```

---

## Task 4: `fingerprint` UA reconcile from live browser + in-page `navigator.language(s)`

**Files:**
- Modify: `packages/fingerprint/src/fingerprint.ts`
- Modify: `packages/fingerprint/src/fingerprint.test.ts`
- Create: `tests/integration/src/fingerprint.integration.test.ts`
- Modify: `tests/integration/package.json`

`applyFingerprint` (a) rewrites the spoofed UA's `Chrome/x.y.z.w` token to match the live `browser.version()` (no constant, no drift — works for system Chrome / newer downloads), and (b) overrides in-page `navigator.language`/`languages` to match the locale. Both are defensive: a parse failure falls back silently (never throws).

- [ ] **Step 1: Add the failing unit tests** to `packages/fingerprint/src/fingerprint.test.ts`.

First, extend the `mockPage` helper to support the new calls:
```ts
function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    emulateTimezone: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
    browser: () => ({ version: vi.fn().mockResolvedValue("HeadlessChrome/144.0.7559.96") }),
    ...overrides,
  } as unknown as Page;
}
```
(Replace the existing no-arg `mockPage()` with this overridable version; update the existing `applyFingerprint` test's `const page = mockPage();` call — it still works.)

Add these tests inside `describe("applyFingerprint", …)`:
```ts
  it("reconciles the UA Chrome version to the live browser version", async () => {
    const page = mockPage({
      browser: () => ({ version: vi.fn().mockResolvedValue("HeadlessChrome/151.0.1.2") }),
    });
    const fp: Fingerprint = {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
    };
    await applyFingerprint(page, fp);
    expect(page.setUserAgent).toHaveBeenCalledWith({
      userAgent: expect.stringContaining("Chrome/151.0.1.2"),
    });
  });

  it("falls back to the generated UA when the browser version is unparseable", async () => {
    const page = mockPage({
      browser: () => ({ version: vi.fn().mockResolvedValue("weird-no-version") }),
    });
    const fp: Fingerprint = {
      userAgent: "X Chrome/144.0.0.0 Y",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
    };
    await applyFingerprint(page, fp);
    expect(page.setUserAgent).toHaveBeenCalledWith({ userAgent: "X Chrome/144.0.0.0 Y" });
  });

  it("overrides in-page navigator.language and languages via evaluateOnNewDocument", async () => {
    const page = mockPage();
    const fp: Fingerprint = {
      userAgent: "X Chrome/144.0.0.0 Y",
      viewport: { width: 1280, height: 800 },
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
    };
    await applyFingerprint(page, fp);
    expect(page.evaluateOnNewDocument).toHaveBeenCalledWith(
      expect.any(Function),
      "de-DE",
      ["de-DE", "de"],
    );
  });
```

- [ ] **Step 2: Run → FAIL**

Run: `pnpm --filter @technical-1/fingerprint test`
Expected: FAIL — UA is not reconciled and `evaluateOnNewDocument` is never called.

- [ ] **Step 3: Implement** — edit `packages/fingerprint/src/fingerprint.ts`.

Add a module-scoped in-page global declaration just below the `import` (line 1):
```ts
// In-page global used inside the evaluateOnNewDocument callback (runs in
// Chromium, not Node). Declare only what the callback touches — not the DOM lib.
declare var navigator: { language: string; languages: readonly string[] };
```

Add a private reconcile helper (place above `applyFingerprint`):
```ts
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
  const version = raw.match(/[\d.]+$/)?.[0];
  if (!version) return ua;
  return ua.replace(/Chrome\/[\d.]+/, `Chrome/${version}`);
}
```

Replace `applyFingerprint`'s JSDoc + body (lines 61–82) with:
```ts
/**
 * Apply a fingerprint to a page: UA (object form, version reconciled to the
 * live browser), viewport, timezone, the `Accept-Language` request header, and
 * an in-page override of `navigator.language`/`navigator.languages` so JS-level
 * reads agree with the header/locale.
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
  await page.setExtraHTTPHeaders({
    "Accept-Language": ACCEPT_LANGUAGE[fp.locale] ?? fp.locale,
  });
  const primary = fp.locale.split("-")[0] ?? fp.locale;
  const languages = [fp.locale, primary];
  await page.evaluateOnNewDocument(
    (locale: string, langs: string[]) => {
      Object.defineProperty(navigator, "language", {
        get: () => locale,
        configurable: true,
      });
      Object.defineProperty(navigator, "languages", {
        get: () => langs,
        configurable: true,
      });
    },
    fp.locale,
    languages,
  );
}
```

- [ ] **Step 4: Run → PASS**

Run: `pnpm --filter @technical-1/fingerprint test`
Expected: PASS. The existing "applies UA (object form)…" test uses `fp.userAgent = "UA/1.0"` (no `Chrome/` token) and the default mock browser version `144.0.7559.96`; reconcile finds no `Chrome/` token to replace → UA stays `"UA/1.0"`, so that assertion still holds. (If it relied on no `evaluateOnNewDocument`, it doesn't — it only asserts the four original calls.)

- [ ] **Step 5: Add the fingerprint integration test.**

Add `@technical-1/fingerprint` to `tests/integration/package.json` `dependencies`:
```json
    "@technical-1/fingerprint": "workspace:^",
```

Create `tests/integration/src/fingerprint.integration.test.ts` (uses the shared `launchFixtureBrowser`/`teardownFixtureBrowser` helper + the `describe.skipIf` gate, mirroring the other 9 integration tests):
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { applyFingerprint, randomFingerprint } from "@technical-1/fingerprint";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";

declare var navigator: { language: string; userAgent: string };

describe.skipIf(process.env["PPTR_IT"] !== "1")("fingerprint integration", () => {
  // Derive the context type from the helper's return — robust to whatever the
  // helper names (or doesn't name) its result type.
  let ctx: Awaited<ReturnType<typeof launchFixtureBrowser>>;
  beforeAll(async () => {
    ctx = await launchFixtureBrowser();
  });
  afterAll(async () => {
    await teardownFixtureBrowser(ctx);
  });

  it("reconciles the UA to the live browser and overrides navigator.language", async () => {
    const page = await ctx.browser.newPage();
    try {
      const fp = { ...randomFingerprint(() => 0), locale: "de-DE", timezoneId: "Europe/Berlin" };
      await applyFingerprint(page, fp);
      await page.goto(`${ctx.server.baseUrl}/`, { waitUntil: "load" });

      const liveMajor = (await ctx.browser.version()).match(/[\d.]+$/)?.[0]?.split(".")[0];
      const result = await page.evaluate(() => ({
        language: navigator.language,
        ua: navigator.userAgent,
      }));
      expect(result.language).toBe("de-DE");
      expect(result.ua).toContain(`Chrome/${liveMajor}`);
    } finally {
      await page.close();
    }
  });
});
```
(Uses the shared helper's actual exported `launchFixtureBrowser`/`teardownFixtureBrowser`; the context type is inferred so no named type import is required. `ctx.browser`/`ctx.server` must match the helper's returned shape — confirm field names against `tests/integration/src/helpers.ts`.)

- [ ] **Step 6: Verify integration + gate**

Run: `pnpm install` (wires the new dep), then `pnpm --filter @technical-1/integration-tests typecheck` (clean).
Run default skip: `pnpm --filter @technical-1/integration-tests test` → the new fingerprint describe SKIPS (PPTR_IT unset), server tests still pass.
Run real: `PPTR_IT=1 pnpm --filter @technical-1/integration-tests test` → all pass incl. the new fingerprint test.
Run: `pnpm turbo run lint test build --output-logs=errors-only` (green).

- [ ] **Step 7: Commit**

```bash
git add packages/fingerprint/src/fingerprint.ts packages/fingerprint/src/fingerprint.test.ts tests/integration/src/fingerprint.integration.test.ts tests/integration/package.json pnpm-lock.yaml
git commit -m "feat(fingerprint): reconcile UA to the live browser version + override in-page navigator.language(s) (P10T4)"
```

---

## Task 5: `fingerprint` geographically-coherent `randomFingerprint`

**Files:**
- Modify: `packages/fingerprint/src/fingerprint.ts`
- Modify: `packages/fingerprint/src/fingerprint.test.ts`

`randomFingerprint` picks `locale`/`timezone` independently (can be incoherent). Replace the independent `LOCALES`/`TIMEZONES` pools with correlated `PROFILES` (locale ↔ timezone ↔ Accept-Language); `userAgent`/`viewport` stay independent. `Fingerprint` interface is unchanged.

- [ ] **Step 1: Update + add tests** in `packages/fingerprint/src/fingerprint.test.ts`.

The existing determinism test asserts seed-1 timezone `"Europe/Berlin"`; with coherent profiles seed-1 (last profile) becomes `fr-FR` ↔ `Europe/Paris`. Update the "clamps to the last pool entry" test's locale/timezone assertions:
```ts
  it("clamps to the last pool entry when rand returns 1.0", () => {
    const fp = randomFingerprint(() => 1);
    expect(fp.userAgent).toContain("X11; Linux x86_64"); // last UA pool entry
    expect(fp.viewport).toEqual({ width: 1280, height: 800 }); // last viewport
    expect(fp.locale).toBe("fr-FR");
    expect(fp.timezoneId).toBe("Europe/Paris"); // coherent with fr-FR
  });
```
(The seed-0 test stays valid: profile 0 is `en-US` ↔ `America/New_York`.)

Add a coherence test inside `describe("randomFingerprint", …)`:
```ts
  it("always pairs locale and timezone from the same geo profile", () => {
    const coherent: Record<string, string> = {
      "en-US": "America/New_York",
      "en-GB": "Europe/London",
      "de-DE": "Europe/Berlin",
      "fr-FR": "Europe/Paris",
    };
    for (let i = 0; i < 200; i++) {
      const fp = randomFingerprint();
      expect(fp.timezoneId).toBe(coherent[fp.locale]);
    }
  });
```

- [ ] **Step 2: Run → FAIL**

Run: `pnpm --filter @technical-1/fingerprint test`
Expected: FAIL — current independent selection produces incoherent pairs (and seed-1 timezone is still `Europe/Berlin`).

- [ ] **Step 3: Implement** — in `packages/fingerprint/src/fingerprint.ts`, replace the `LOCALES`, `TIMEZONES`, and `ACCEPT_LANGUAGE` declarations (lines 21–34) with a profile model:

```ts
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
```

Replace the `randomFingerprint` JSDoc + body (lines 45–59) with:
```ts
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
```

- [ ] **Step 4: Run → PASS**

Run: `pnpm --filter @technical-1/fingerprint test`
Expected: PASS — coherence holds for all 200 draws; seed 0 → `en-US`/`America/New_York`; seed 1 → `fr-FR`/`Europe/Paris`. The `applyFingerprint` "Accept-Language" test (`en-US` → `"en-US,en;q=0.9"`) still passes via the derived `ACCEPT_LANGUAGE`.

- [ ] **Step 5: Gate + commit**

Run: `pnpm turbo run lint test build --output-logs=errors-only` (green).
```bash
git add packages/fingerprint/src/fingerprint.ts packages/fingerprint/src/fingerprint.test.ts
git commit -m "feat(fingerprint): geographically-coherent randomFingerprint via correlated profiles (P10T5)"
```

---

## Task 6: `chrome-setup` resolves latest stable Chrome on fresh install

**Files:**
- Modify: `packages/chrome-setup/src/chrome.ts`
- Modify: `packages/chrome-setup/src/chrome.test.ts`
- Modify: `packages/chrome-setup/README.md`
- Modify: `.github/workflows/ci.yml`

By default `downloadChrome`/`ensureChrome` resolve the latest **stable** Chrome build (via `@puppeteer/browsers` `resolveBuildId`) instead of the pinned `DEFAULT_CHROME_BUILD`. An explicit `buildId` pins a reproducible build; if stable resolution fails (offline/error), fall back to `DEFAULT_CHROME_BUILD` (never throw for that reason). `DEFAULT_CHROME_BUILD` is retained as that fallback + an exported pin consumers can pass.

- [ ] **Step 1: Add the failing tests** in `packages/chrome-setup/src/chrome.test.ts`.

Extend the `@puppeteer/browsers` mock (lines 7–11) to include `resolveBuildId`:
```ts
vi.mock("@puppeteer/browsers", () => ({
  Browser: { CHROME: "chrome" },
  detectBrowserPlatform: vi.fn(() => "mac_arm"),
  install: vi.fn(async () => ({ executablePath: "/downloaded/chrome" })),
  resolveBuildId: vi.fn(async () => "200.0.0.0"),
}));
```

Add tests inside `describe("downloadChrome", …)`:
```ts
  it("resolves the latest stable build when no buildId is given", async () => {
    await downloadChrome({ cacheDir: dir });
    expect(browsers.resolveBuildId).toHaveBeenCalledWith("chrome", "mac_arm", "stable");
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: "200.0.0.0" }),
    );
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
```
Add `DEFAULT_CHROME_BUILD` to the import on line 14:
```ts
import { resolveChromePath, downloadChrome, ensureChrome, DEFAULT_CHROME_BUILD } from "./chrome.js";
```

- [ ] **Step 2: Run → FAIL**

Run: `pnpm --filter @technical-1/chrome-setup test`
Expected: FAIL — `resolveBuildId` is never called; install uses `DEFAULT_CHROME_BUILD` unconditionally.

- [ ] **Step 3: Implement** — in `packages/chrome-setup/src/chrome.ts`:

Add `resolveBuildId` to the import (line 7):
```ts
import { Browser, detectBrowserPlatform, install, resolveBuildId } from "@puppeteer/browsers";
```

Add a private resolver above `downloadChrome`:
```ts
/**
 * Pick the build to install: an explicit `buildId` pins it (reproducible);
 * otherwise resolve the latest stable Chrome. If stable resolution fails
 * (offline / resolver error) fall back to the pinned DEFAULT_CHROME_BUILD
 * rather than throwing.
 */
async function selectBuildId(
  platform: NonNullable<ReturnType<typeof detectBrowserPlatform>>,
  explicit: string | undefined,
  logger: LoggerOption["logger"],
): Promise<string> {
  if (explicit) return explicit;
  try {
    const id = await resolveBuildId(Browser.CHROME, platform, "stable");
    logger?.log(`Resolved latest stable Chrome ${id}`, "step");
    return id;
  } catch (err) {
    logger?.log(
      `Stable Chrome resolution failed; using pinned ${DEFAULT_CHROME_BUILD}`,
      "step",
    );
    return DEFAULT_CHROME_BUILD;
  }
}
```

Change the `DownloadChromeOptions.buildId` doc (line 82) and the `downloadChrome` `buildId` line (line 98). New JSDoc for the field:
```ts
  /** Chrome build id. Default: the latest stable Chrome, resolved at install
   *  time. Pass an explicit version (e.g. DEFAULT_CHROME_BUILD) to pin a
   *  reproducible build. */
  buildId?: string;
```
Replace line 98 (`const buildId = opts.buildId ?? DEFAULT_CHROME_BUILD;`) with:
```ts
  const buildId = await selectBuildId(platform, opts.buildId, opts.logger);
```
(The `platform` variable already exists from `detectBrowserPlatform()` on line 92; `selectBuildId` runs after the platform null-check.)

- [ ] **Step 4: Run → PASS**

Run: `pnpm --filter @technical-1/chrome-setup test`
Expected: PASS. The existing "delegates to install … buildId: '100.0.0.0'" test passes an explicit buildId → still pins it. The existing "downloads when nothing is resolvable" test (no buildId) now resolves stable `"200.0.0.0"` then installs → still asserts install called + returns the mocked path.

- [ ] **Step 5: Document** — in `packages/chrome-setup/README.md`, add/extend a note:

```markdown
### Chrome version

`ensureChrome`/`downloadChrome` install the **latest stable** Chrome by default
(resolved at install time), so fresh installs stay current. For reproducible
installs, pass an explicit `buildId` (the pinned `DEFAULT_CHROME_BUILD` is
exported for this purpose):

`ensureChrome({ buildId: DEFAULT_CHROME_BUILD })`

If stable resolution fails (offline), it falls back to `DEFAULT_CHROME_BUILD`.
```

- [ ] **Step 6: Update the CI Chrome cache key** — in `.github/workflows/ci.yml`, the integration job's "Cache Chrome for Testing" step keys on `${{ runner.os }}-chrome-144.0.7559.96`. Since the installed build now tracks stable, the version-pinned key is wrong. Change the `key:` to a non-version-pinned key and add a clarifying comment:
```yaml
      - name: Cache Chrome for Testing
        uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
        with:
          path: ~/.cache/puppeteer
          # Not pinned to a version: chrome-setup resolves latest-stable at
          # install time. The cache accumulates builds; when stable advances,
          # the new build is downloaded during the run (covered by hookTimeout).
          key: ${{ runner.os }}-puppeteer-cache
```

- [ ] **Step 7: Verify + gate + commit**

Run: `pnpm --filter @technical-1/chrome-setup test` (pass), `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"` (OK), `pnpm turbo run lint test build --output-logs=errors-only` (green).
```bash
git add packages/chrome-setup/src/chrome.ts packages/chrome-setup/src/chrome.test.ts packages/chrome-setup/README.md .github/workflows/ci.yml
git commit -m "feat(chrome-setup): install latest stable Chrome by default, explicit buildId to pin (P10T6)"
```

---

## Task 7: Update examples for the new surface

**Files:**
- Modify: `examples/src/navigation.example.ts`
- Modify: `examples/src/chrome-setup.example.ts`

Examples are typecheck-gated API-drift detectors — update them to exercise the new surface so drift is caught.

- [ ] **Step 1: Update `examples/src/navigation.example.ts`** — show `goto`'s return and import `RetryOptions` from the navigation barrel. Read the current file first; change the `RetryOptions` import source from `@technical-1/retry` to `@technical-1/navigation` (if present), and show using the response, e.g. within the existing `demo`:
```ts
import { goto, type RetryOptions } from "@technical-1/navigation";
// ...inside demo(page):
const res = await goto(page, "https://example.com", { retry: { retries: 2 } satisfies RetryOptions });
console.log("status:", res?.status() ?? "(no response)");
```
(Adapt to the file's existing structure; keep it typecheck + lint clean. Remove any now-unused `@technical-1/retry` import.)

- [ ] **Step 2: Update `examples/src/chrome-setup.example.ts`** — show the default (stable) and the explicit-pin form:
```ts
import { ensureChrome, DEFAULT_CHROME_BUILD, type PlatformName } from "@technical-1/chrome-setup";
// ...inside the demo:
const latest = await ensureChrome();                       // latest stable
const pinned = await ensureChrome({ buildId: DEFAULT_CHROME_BUILD }); // reproducible
const platform: PlatformName = "darwin";
console.log(latest, pinned, platform);
```
(Adapt to the file's existing structure; keep it typecheck + lint clean.)

- [ ] **Step 3: Verify + commit**

Run: `pnpm --filter @technical-1/examples typecheck && pnpm --filter @technical-1/examples lint` (clean), then `pnpm turbo run lint test build --output-logs=errors-only` (green).
```bash
git add examples/src/navigation.example.ts examples/src/chrome-setup.example.ts
git commit -m "docs(examples): exercise goto's response, re-exported types, and stable Chrome install (P10T7)"
```

---

## Task 8: Changesets + whole-monorepo gate + invariant sweep

**Files:**
- Create: `.changeset/p10-navigation.md`, `.changeset/p10-chrome-setup.md`, `.changeset/p10-pdf.md`, `.changeset/p10-fingerprint.md`

- [ ] **Step 1: Create one changeset per touched package.**

`.changeset/p10-navigation.md`:
```markdown
---
"@technical-1/navigation": minor
---

`goto` now returns the `HTTPResponse | null` from the navigation so callers can
gate on HTTP status. `RetryOptions` is re-exported from the package barrel.
```

`.changeset/p10-chrome-setup.md`:
```markdown
---
"@technical-1/chrome-setup": minor
---

`ensureChrome`/`downloadChrome` install the latest stable Chrome by default
(resolved at install time); pass an explicit `buildId` to pin a reproducible
build (falls back to the pinned `DEFAULT_CHROME_BUILD` if resolution fails).
`PlatformName` is now exported.
```

`.changeset/p10-pdf.md`:
```markdown
---
"@technical-1/pdf": minor
---

`pageToPdf` deep-merges the `margin` per side, so a partial margin keeps the
unspecified sides at the 1cm default instead of dropping them to 0.
```

`.changeset/p10-fingerprint.md`:
```markdown
---
"@technical-1/fingerprint": minor
---

`applyFingerprint` reconciles the spoofed UA's Chrome version to the live
browser and overrides in-page `navigator.language`/`languages`.
`randomFingerprint` now produces geographically-coherent locale/timezone pairs.
```

- [ ] **Step 2: Whole-monorepo gate**

Run: `pnpm turbo run lint test build --output-logs=errors-only` → all green.
Run: root `pnpm vitest run` → all unit tests pass (count rises by the new unit tests).
Run: `pnpm --filter @technical-1/integration-tests test` (PPTR_IT unset) → integration tests SKIP, server tests pass.
Run: `PPTR_IT=1 pnpm --filter @technical-1/integration-tests test` → all integration tests pass (incl. the new fingerprint test).

- [ ] **Step 3: Re-verify the `@types/node` consumer notes** (Plan 09 method) — the changes don't add new Node-typed `.d.ts` surface, but confirm:
```bash
grep -rl "## Requirements" packages/*/README.md | sort
```
Expected: still exactly `chrome-setup`, `logger`, `navigation`, `retry`. (If `goto`'s `HTTPResponse` return or any change introduced a new Node-typed reference, add/adjust the note — verify by the Plan 09 standalone-`.d.ts` compile check if unsure.)

- [ ] **Step 4: Invariant sweep**
```bash
grep -rIi autom8ops . --exclude-dir=node_modules --exclude-dir=.git   # only plan-doc self-refs
git log 8ca661c..HEAD --format='%an <%ae>' | sort -u                   # only the allowlisted Technical-1 identity
pnpm changeset status                                                  # lists the new minor bumps
```

- [ ] **Step 5: Commit**
```bash
git add .changeset/p10-navigation.md .changeset/p10-chrome-setup.md .changeset/p10-pdf.md .changeset/p10-fingerprint.md
git commit -m "chore: changesets for the Plan 10 surface review (P10T8)"
```

---

## Self-review checklist

- [ ] `navigation.goto` returns `HTTPResponse | null`; contract docs updated; integration asserts a 200.
- [ ] `RetryOptions` importable from `@technical-1/navigation`; `PlatformName` exported from `@technical-1/chrome-setup` and tidied to `NodeJS.Platform`.
- [ ] `pageToPdf` deep-merges margins per side; README documents partial-margin semantics.
- [ ] `applyFingerprint` reconciles UA to `browser.version()` (silent fallback on parse failure) and overrides in-page `navigator.language`/`languages`; fingerprint integration test verifies both against real Chrome.
- [ ] `randomFingerprint` always pairs locale+timezone from one profile; `Fingerprint` interface unchanged; seed-1 timezone updated to `Europe/Paris`.
- [ ] `chrome-setup` installs latest stable by default; explicit `buildId` pins; offline falls back to `DEFAULT_CHROME_BUILD`; CI Chrome cache key no longer pins a version.
- [ ] Examples exercise the new surface and stay typecheck+lint clean.
- [ ] One changeset per touched package; `pnpm turbo run lint test build` green; default `pnpm test` does NOT launch Chrome; `PPTR_IT=1` integration suite passes.
- [ ] No `as`/`any`/`@ts-ignore` in `src/`; no AI attribution in commits; single allowlisted author.
- [ ] No new published packages; no live-internet tests.

---

## After Plan 10 merges

1. Update the roadmap: mark Plan 10 ✅ DONE.
2. Plans 11–12 (the `Puppeteer-Template` repo: `electron-gui-app` then `cli-app` + repo polish) consume the published `@technical-1/*` packages — written iteratively after Plan 10 verifies.
3. The first `release.yml` run still requires the npm scope + `NPM_TOKEN` per `docs/npm-publish-checklist.md`.
