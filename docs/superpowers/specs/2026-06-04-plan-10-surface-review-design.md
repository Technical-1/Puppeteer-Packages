# Plan 10 — Pre-1.0 Surface Review — Design

**Date:** 2026-06-04
**Repo:** `Puppeteer-Packages` (`@technical-1/*`)
**Status:** Design approved in brainstorming; awaiting written-spec review before
`writing-plans` produces the implementation plan.
**Predecessor:** Plan 09 (examples + integration tier + release pipeline) — ✅ merged.
**Source roadmap:** `docs/superpowers/plans/2026-05-18-puppeteer-suite-roadmap.md`
(the "Plan 09 release decisions to make deliberately" + "Deferred decisions"
sections enumerate the items resolved here).

## Purpose

Discharge the public-API and realism decisions deliberately deferred from
Plans 01–09, so the suite's surface is intentional before the first `1.0`.
No new published packages. Seven changes across five packages
(`navigation`, `chrome-setup`, `pdf`, `fingerprint`, `core` only if needed),
each preserving the suite's cemented conventions:

- typed `@technical-1/core` errors (no `{success:false}`);
- DI-mockable browser pattern (`import type` from `puppeteer-core`, inject
  `Page`/`Browser`; unit tests use plain object mocks, never real Chrome);
- module-scoped `declare var` for typing in-page `evaluate`/`evaluateOnNewDocument`
  callbacks (no DOM lib, no `as`);
- dual ESM+CJS build; `files: ["dist"]`; per-condition `exports`;
- ≥1 unit test per exported function; browser-driving changes also add a
  `PPTR_IT=1` integration test against the local fixture server (Plan 09 tier);
- no live-internet tests.

## Decisions (all confirmed in brainstorming)

| # | Item | Decision |
|---|------|----------|
| 1 | `navigation.goto` return type | Return `HTTPResponse \| null` (additive) |
| 2 | Selective re-exports | Re-export `RetryOptions` (navigation) + export & tidy `PlatformName` (chrome-setup) |
| 3 | `pdf` margin merge | Per-side deep-merge |
| 4 | `fingerprint` UA version | Reconcile from the **live** browser (`page.browser().version()`) — no shared constant |
| 5 | `fingerprint` in-page locale | Override `navigator.language`/`languages` via `evaluateOnNewDocument` |
| 6 | `fingerprint` random coherence | Geographically-coherent profiles (correlated `locale`↔`timezone`↔`Accept-Language`) |
| 7 | `chrome-setup` fresh install | Resolve the latest **stable** Chrome on install; pinned `DEFAULT_CHROME_BUILD` as fallback/override |

---

## Item 1 — `navigation.goto` → `Promise<HTTPResponse | null>`

**Current** (`packages/navigation/src/navigation.ts:35`): `goto(page, url, opts?)
: Promise<void>`; the `HTTPResponse | null` returned by `page.goto` (line 46)
is discarded.

**Design:**
- Change the return type to `Promise<HTTPResponse | null>`. Capture the response
  inside the `withRetry` closure and return it; the resolved value propagates
  out of `withRetry` unchanged.
- `import type { HTTPResponse } from "puppeteer-core"` (peer dep — no new dep,
  no `@types/node` implication; `HTTPResponse` is a puppeteer-core type).
- **Contract unchanged:** HTTP 4xx/5xx still do NOT count as navigation failure
  (documented). The return simply stops discarding the response so callers can
  gate on `res?.status()` / `res?.ok()`. JSDoc updated to document the return
  and that `null` is possible (same-document navigations, `about:blank`, etc.).
- Additive for existing callers (they ignore the return).
- `HTTPResponse` is reachable from a consumer's own `puppeteer-core` peer; no
  re-export needed (note it in the README so consumers know where it comes from).

**Tests:**
- Unit: DI mock whose `goto` returns a sentinel response object → `goto` returns
  that object; mock returning `null` → `goto` returns `null`; failure path still
  throws `NavigationError`.
- Integration (`PPTR_IT=1`): `goto(page, fixtureUrl)` returns a response with
  `status() === 200`.

**Changeset:** `navigation` minor (additive return type).

---

## Item 2 — Selective re-exports

**Current:**
- `RetryOptions` (defined + exported from `@technical-1/retry`) is reachable via
  `GotoOptions.retry` but is NOT re-exported from `@technical-1/navigation`'s
  barrel — a consumer must import it from `@technical-1/retry` separately.
- `PlatformName` is a **private** type in `chrome-setup`
  (`packages/chrome-setup/src/chrome.ts:14`), used by
  `ResolveChromeOptions.platform`, never exported. Its definition
  `NodeJS.Platform | "linux" | "darwin" | "win32"` is redundant — those literals
  are already members of `NodeJS.Platform`.

**Design:**
- `packages/navigation/src/index.ts`: add
  `export type { RetryOptions } from "@technical-1/retry";` so the type is
  obtainable from the package whose options use it.
- `packages/chrome-setup`: make `PlatformName` `export type` and re-export it
  from the barrel. **Tidy** the redundant union to just `NodeJS.Platform`
  (or the narrower set the resolver actually supports) **without changing the
  set of accepted values** — verify against what `@puppeteer/browsers`'
  platform resolution accepts so no runtime behavior changes.

**Tests:** a small type-level assertion (import both from the consumer barrel and
assign) compiled by the existing `typecheck` task; confirm `pnpm pack`/build still
surfaces the names. Examples updated to import `RetryOptions` from
`@technical-1/navigation`.

**Changeset:** `navigation` + `chrome-setup` minor (additive exports).

---

## Item 3 — `pdf` per-side margin deep-merge

**Current** (`packages/pdf/src/pdf.ts:18`): `const merged = { ...DEFAULTS, ...opts }`
— a caller's `margin` object replaces the default wholesale, so
`{ margin: { top: "2cm" } }` drops `bottom/left/right` (they fall to puppeteer's
0, not the 1cm default).

**Design:**
- Deep-merge the `margin` sub-object:
  `margin: { ...DEFAULTS.margin, ...(opts.margin ?? {}) }`, applied only when
  building the merged options; all other fields keep the existing shallow merge.
- **Documented behavior change:** a partial `margin` now keeps unspecified sides
  at the 1cm default instead of 0. Call it out in the README + JSDoc + changelog.

**Tests:** unit — `pageToPdf(page, { margin: { top: "2cm" } })` passes
`{ top:"2cm", bottom:"1cm", left:"1cm", right:"1cm" }` to the `page.pdf` DI mock;
`{}` still yields all-1cm; a full 4-side margin overrides all four.

**Changeset:** `pdf` minor (behavior change, pre-1.0; documented).

---

## Item 4 — `fingerprint` UA version reconciled from the live browser

**Current** (`packages/fingerprint/src/fingerprint.ts`): UA pool hardcodes
`Chrome/144.0.0.0`. It matches `chrome-setup`'s `DEFAULT_CHROME_BUILD` major
*today* but the two drift independently; a UA/binary version mismatch is a
detection signal, and a pinned UA also mismatches a system Chrome or a newer
download.

**Design (no shared constant — reconcile against reality):**
- `applyFingerprint(page, fp)` reads the live browser version via
  `page.browser().version()` (returns e.g. `"HeadlessChrome/144.0.7559.96"` or
  `"Chrome/144.0.7559.96"`), extracts the Chrome version token, and rewrites the
  UA's `Chrome/<x.y.z.w>` token to match the **actual running binary** before
  calling `page.setUserAgent`. Result: the spoofed UA's Chrome version always
  agrees with the real Chrome — system Chrome, a newer download, anything — with
  zero cross-package coupling and no constant to maintain.
  - Reconcile defensively: if `browser.version()` is unparseable or lacks a
    Chrome token (unexpected), fall back to the UA string as generated (logged
    via the `LoggerOption`, never thrown).
- `randomFingerprint()` (pure, no browser) keeps a sensible default version in
  its generated `userAgent` so the string is realistic when used standalone;
  `applyFingerprint` corrects it to the live version at apply time. The default
  is a plain literal in `fingerprint` (no dependency on `core`/`chrome-setup`);
  drift of this default is now harmless because apply-time reconciliation
  overrides it.

**Interaction with item 7:** because the UA is reconciled from the live browser,
making `chrome-setup` install the latest stable Chrome (item 7) automatically
keeps the applied UA current — the two items compose.

**Tests:**
- Unit: `applyFingerprint` with a DI `page` whose `browser().version()` returns a
  crafted `"HeadlessChrome/151.0.1.2"` → the UA passed to `setUserAgent` contains
  `Chrome/151.0.1.2` (token swapped); unparseable version → original UA used,
  no throw.
- Integration (`PPTR_IT=1`): after `applyFingerprint`, the in-page
  `navigator.userAgent` Chrome major equals the real `browser().version()` major.

**Changeset:** `fingerprint` minor.

---

## Item 5 — `fingerprint` in-page `navigator.language(s)` override

**Current:** `applyFingerprint` sets only the `Accept-Language` HTTP header; a
JS-level fingerprinter reads the launch-locale `navigator.language` /
`navigator.languages`, so header and in-page locale can disagree (a signal).

**Design:**
- In `applyFingerprint`, add a `page.evaluateOnNewDocument(...)` that
  `Object.defineProperty`-overrides `navigator.language` (= `fp.locale`) and
  `navigator.languages` (= a small derived list, e.g.
  `[fp.locale, primarySubtag]` where `primarySubtag = fp.locale.split("-")[0]`),
  so in-page values match the `Accept-Language` header and the locale.
- Type the callback with the suite's module-scoped `declare var navigator { ... }`
  convention (only the members used; no DOM lib, no `as`).
- `evaluateOnNewDocument` runs before page scripts on every navigation in the
  page; `applyFingerprint`'s existing "call before navigation" contract already
  guarantees correct ordering. Document that the override persists for the page's
  lifetime.

**Tests:**
- Unit: DI `page` records the `evaluateOnNewDocument` registration (assert it was
  called; optionally assert the generated `languages` for a sample locale).
- Integration (`PPTR_IT=1`): apply fingerprint, navigate to a fixture, assert
  in-page `navigator.language === fp.locale` and `navigator.languages[0] ===
  fp.locale`.

**Changeset:** `fingerprint` minor (covered by the item-4 bump).

---

## Item 6 — `fingerprint` geographically-coherent `randomFingerprint`

**Current:** `randomFingerprint` picks `userAgent`, `viewport`, `locale`,
`timezoneId` independently, so combinations can be geographically incoherent
(e.g. `en-US` + `Europe/Berlin`).

**Design:**
- Introduce a **profile** table that bundles the region-correlated fields:
  `{ locale, timezoneId, acceptLanguage }`. Example coherent profiles:
  - `en-US ↔ America/New_York`
  - `en-GB ↔ Europe/London`
  - `de-DE ↔ Europe/Berlin`
  - `fr-FR ↔ Europe/Paris`
  (Exact set finalized in the plan; each entry is internally coherent.)
- `randomFingerprint(rand?)` picks **one profile** (coherent
  `locale`/`timezoneId`, and the matching `Accept-Language` used by
  `applyFingerprint`) plus an **independent** `userAgent` (OS-based) and
  `viewport` (device-based) — both region-agnostic, so independence is fine.
- **`Fingerprint` interface is unchanged** (`userAgent`, `viewport`, `locale`,
  `timezoneId`) — only the selection logic and the backing pools change. The
  existing `ACCEPT_LANGUAGE` locale→header mapping is folded into the profile
  table (single source for a profile's header).

**Tests:** over many seeded `rand` draws, assert each result's `locale` and
`timezoneId` belong to the **same profile** (coherence holds for every draw);
assert `userAgent`/`viewport` still vary independently; seeded determinism
preserved.

**Changeset:** `fingerprint` minor.

---

## Item 7 — `chrome-setup` resolves latest stable Chrome on fresh install

**Current:** `ensureChrome`/`downloadChrome` install the pinned
`DEFAULT_CHROME_BUILD = "144.0.7559.96"` (`packages/chrome-setup/src/chrome.ts:12`).
Reproducible, but goes stale.

**Design:**
- Add **stable-channel resolution**: when no explicit build is requested,
  `ensureChrome` resolves the current stable Chrome build id via
  `@puppeteer/browsers` (`resolveBuildId(Browser.CHROME, platform, "stable")`)
  and installs that, so a fresh install is current.
- Keep determinism available and the function tolerant:
  - An explicit `buildId` option (a concrete version string) pins exactly that
    build — restores fully reproducible installs.
  - `DEFAULT_CHROME_BUILD` is retained as the **offline/fallback** pin: if stable
    resolution fails (no network / resolver error), fall back to the pinned build
    rather than throwing, logged via `LoggerOption`. (`resolveBuildId` is a
    network lookup; wrap it and degrade gracefully.)
  - Resolution errors that are not "offline" are wrapped per the suite's
    convention: `new PptrKitError(msg, { cause, retryable: <transient?>, context })`.
- **Default-behavior decision (flagged for spec review):** the recommended
  default is **resolve stable** (honors "always updated"); `DEFAULT_CHROME_BUILD`
  is fallback + the value an explicit pin would use. This changes `ensureChrome`'s
  default from "install 144" to "install current stable." Acceptable pre-1.0 and
  aligned with the stated goal; documented prominently. If reproducible-by-default
  is preferred instead, flip the default to the pin and make stable opt-in — call
  this out at review.
- Surface: extend `EnsureChromeOptions` with the build/channel control
  (exact shape — `buildId?: string` and/or `channel?: "stable" | ...` — settled
  in the plan; keep it minimal and typed, re-export any new public type per
  item 2's convention). Composes with item 4: the live UA reconcile means the
  applied fingerprint automatically tracks whatever stable build was installed.

**Tests:**
- Unit (no network, no real Chrome — DI the resolver/installer seam via the
  suite's `*ForTesting` pattern so the injectable resolver does NOT leak into the
  published `.d.ts`): stable resolution returns a build id → that id is installed;
  resolver throws/offline → falls back to `DEFAULT_CHROME_BUILD` (no throw);
  explicit `buildId` → bypasses resolution and pins exactly.
- Integration (`PPTR_IT=1`): unchanged — the existing tier already exercises real
  Chrome via `ensureChrome`; confirm it still resolves/launches (CI cache key in
  `ci.yml` may need to stop hardcoding `144.0.7559.96` — see cross-cutting).

**Changeset:** `chrome-setup` minor (new option + default-resolution change,
documented).

---

## Cross-cutting

- **CI Chrome cache key.** `ci.yml`'s integration job caches `~/.cache/puppeteer`
  keyed `${{ runner.os }}-chrome-144.0.7559.96`. With item 7 resolving stable,
  the installed build can change; the cache key must not pin a now-wrong version.
  Plan must update the key (e.g. drop the version, or key on a resolved value /
  lockfile hash) so the cache stays correct without silently serving a stale
  Chrome. Keep `hookTimeout` ≥ cold-download budget (Plan 09 convention).
- **Examples.** Update `examples/src/navigation.example.ts` (show using `goto`'s
  returned `HTTPResponse`), `…/chrome-setup.example.ts` (show the stable/explicit
  build option), and import `RetryOptions` from `@technical-1/navigation`. All
  examples stay typecheck+lint clean (Plan 09 gate).
- **`@types/node` notes.** Items don't add new Node-typed `.d.ts` surface beyond
  what already carries the note (navigation, chrome-setup, retry — via
  `AbortSignal`); re-verify with the Plan 09 compile-test method after changes.
- **Changesets.** One changeset per touched package
  (`navigation`, `chrome-setup`, `pdf`, `fingerprint`; `core` only if a shared
  symbol is actually added — current design does NOT require a core change).
- **No new published packages; no live-internet tests; commits authored by the
  allowlisted `Technical-1` identity; no AI attribution.**

## Out of scope (future)

- Broader fingerprint surfaces (canvas/WebGL/audio noise, font enumeration,
  WebRTC IP leak) — a dedicated anti-detection plan.
- A full reproducible-install lockfile for the resolved Chrome build (beyond the
  fallback pin) — revisit if non-determinism causes CI friction.

## Risks / watch-items

- **Item 7 default change** is the most behaviorally significant; the stable
  resolver adds a network lookup to `ensureChrome` (mitigated by graceful
  fallback to the pin) and makes installs non-deterministic by default
  (mitigated by explicit `buildId`). Confirm the default at review.
- **Item 4 reconcile** depends on `browser.version()` string format; parse
  defensively and fall back to the generated UA.
- **Item 6 profile redesign** changes random output distribution; ensure seeded
  determinism for tests is preserved.
- **Item 3 margin change** is a behavior change; the changelog must make the
  partial-margin semantics explicit.
