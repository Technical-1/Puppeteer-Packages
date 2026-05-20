# Puppeteer Suite — Implementation Roadmap

**Date:** 2026-05-18
**Source spec:** `Puppeteer-Template/docs/superpowers/specs/2026-05-18-puppeteer-suite-architecture-design.md`
**Status:** Active. Decomposition of the approved north-star architecture into
independently buildable, independently testable implementation plans.

## Why this decomposition

The architecture spans two repos, ~19 packages, 2 templates, and monorepo
tooling. Per the `writing-plans` scope check, one mega-plan is not reviewable.
Plans are split along the spec's own **acyclic dependency tiers** (§4.2): every
plan depends only on the output of earlier plans, so each plan produces working,
testable software and the next plan can rely on it.

```
core (no deps)
  └─> utility tier: retry, logger, config        (core only)
        └─> capability tier                       (core + utilities + peer puppeteer-core)
              └─> examples + integration harness + release
                    └─> templates                 (consume published @technical-1/*)
```

## Cadence

Iterative: write a plan → execute + verify it → write the next plan informed by
what we learned. Plans below numbered in execution order.

## Plan Index

### Repo: `Puppeteer-Packages`

| # | Plan | Packages / Output | Depends on |
|---|---|---|---|
| 01 | Monorepo foundation + `core` | pnpm workspace, Turborepo, Changesets, `tsconfig.base`, shared `tsup` setup, `ci.yml` skeleton, `@technical-1/core` (types, error hierarchy, `Logger` interface) | — |
| 02 | Utility tier | `retry`, `logger`, `config` | 01 |
| 03 | Browser foundation | `chrome-setup` (from Kanfer `chrome-path` + `download-chrome`), `launcher` (pool, cleanup-in-`finally`) | 01, 02 |
| 04 | Navigation & data | `navigation` (goto+retry, waitUntil, SPA idle), `interaction-helpers` (from Kanfer `helpers.js`, hardened + typed errors), `extract` | 01, 02, 03 |
| 05 | Anti-detection | `stealth`, `fingerprint`, `human`, `proxy` | 01, 02, 03 |
| 06 | State & traffic | `session`, `network` | 01, 02, 03 |
| 07 | Output | `screenshots` (from Kanfer `helpers.js`), `pdf`, `downloads` | 01, 02, 03 |
| 08 | Captcha | `captcha` (adapter interface + reference 2captcha adapter, no bundled creds) | 01, 02 |
| 09 | Examples + integration + release | `examples/` per package, local static fixture HTTP server, integration tier (`PPTR_IT=1`) CI job, `release.yml` Changesets publish | 01–08 |

### Repo: `Puppeteer-Template`

| # | Plan | Output | Depends on |
|---|---|---|---|
| 10 | `electron-gui-app` template | Restructure seeded Kanfer code, de-brand (no "Kanfer D-Toolkit", no prohibited work-brand string per spec §3), runner composing `@technical-1/*`, EventEmitter logger → live UI panel, retained electron-builder signing/notarization repointed to template identity, fixture smoke script, documented dev-link to local `Puppeteer-Packages` | 01–09 published or dev-linked |
| 11 | `cli-app` template + repo polish | `commander` CLI template (console logger, exit codes), `docs/` wiring guide, `scripts/new` degit-style helper, template `ci.yml`, remove superseded seeded root files | 10 |

## Cross-cutting invariants (apply to every plan)

- Commits authored `Jacob Kanfer <kanfer@users.noreply.github.com>` (spec §11).
- The prohibited work-brand string named in spec §3 must never appear in
  either repo (this roadmap deliberately avoids writing the literal token).
- Every exported function has ≥1 unit test; capability packages add ≥1
  integration test (spec §9).
- `puppeteer-core` is a `peerDependency` on browser-driving packages; never a
  dependency (spec §4.1).
- Functions throw typed `@technical-1/core` errors; no `{success:false}` shapes
  (spec §4.6).
- No live-internet tests — local fixtures only (spec §12).

## Deferred decisions (carry forward)

- **`examples/` workspace layout** — `pnpm-workspace.yaml` ships with an
  `examples` entry (single directory). Plan 09 owns the examples layout; when
  it chooses between a single `examples` package vs. per-package example
  sub-packages, it MUST set the `pnpm-workspace.yaml` glob accordingly
  (`examples` for a single package, `examples/*` for sub-packages). Until then
  the entry is inert (no examples exist) and harmless.

## Known issues to resolve in Plan 09 (publish/release)

- **Duplicate `//# sourceMappingURL` in tsup output.** tsup 8.5.1 (latest as of
  2026-05-18 — there is no 8.5.3) emits the sourcemap directive twice in every
  `dist/index.js` / `dist/index.cjs`. The two directives are identical and
  point to the same valid map, so it is functionally harmless (bundlers and
  Node both resolve correctly) — deferred, not ignored. Plan 09 (which builds
  the actual npm publish pipeline / `release.yml`) MUST add a deterministic
  sourcemap-comment dedup (post-build step or a vetted tsup plugin in
  `tsup.config.base.ts`) and verify it against the real `npm pack` tarball
  before first publish. Affects all packages via the shared base config.

## CI hardening deferred (before repo goes public / Plan 09)

- **SHA-pin GitHub Actions.** `ci.yml` uses floating `@v4` tags
  (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node`). Before the
  repo is public or gains external contributors, pin all actions to immutable
  commit SHAs via a vetted tool (`pinact` / `pin-github-action` / Dependabot) —
  do NOT hand-paste SHAs. Applies to `release.yml` (Plan 09) too.
- **CI install/build duplication.** `build` and `integration` jobs each run
  `pnpm install` + `turbo run build` independently. Negligible for `core`;
  before the monorepo grows, Plan 09 should bridge them via
  `upload-artifact`/`download-artifact` on `dist/` or Turbo remote cache
  (spec §10 lists remote cache as a documented opt-in).

## Plan 09 release decisions to make deliberately

- **Internal-dep range strategy.** Mechanics: `changeset version` does NOT
  rewrite `workspace:*` entries (it only bumps `version` fields); the
  `workspace:*` → concrete-version rewrite happens at `pnpm publish` time, and
  with the current setup pnpm pins to the EXACT resolved version (not a caret).
  `.changeset/config.json`'s `updateInternalDependencies: "patch"` is inert for
  an all-`workspace:*` graph where every package has its own changeset (it only
  cascades into dependents that lack their own changeset). Net effect: a
  consumer won't auto-satisfy a newer `core` without an explicit dependent
  release. Plan 09 must consciously confirm or change this (e.g. `workspace:^`)
  before the first `changeset publish`, and surface the decision as a comment
  in `release.yml`.
- **`fingerprint` realism follow-ups (pre-1.0 / v2).** (a) The UA pool's
  Chrome major must stay in sync with `chrome-setup`'s `DEFAULT_CHROME_BUILD`
  (currently both 144 — a mismatch is a detection signal). Pre-1.0: decide
  whether `fingerprint` should derive the UA Chrome version from a shared
  constant rather than a hardcoded pool (would add a dep — currently standalone,
  so deferred). (b) `applyFingerprint` sets only the `Accept-Language` header;
  a full v2 spoof would also override in-page `navigator.language`/`languages`
  via `evaluateOnNewDocument`. (c) `randomFingerprint` picks fields
  independently (possible geographic incoherence) — v2 could correlate them.
  All three are documented v1 limitations in the package JSDoc.
- **`navigation.goto` return type (pre-1.0 consideration).** `goto` returns
  `void` and deliberately does NOT treat HTTP 4xx/5xx as a navigation failure
  (documented contract — many valid uses scrape error pages). A pre-1.0 review
  should decide whether `goto` should return `HTTPResponse | null` so callers
  can gate on status without `goto` imposing policy. Not a defect — a conscious
  surface decision deferred.
- **Pre-1.0 API-surface review.** Some types are reachable via option fields
  but not re-exported from their package barrel. Examples: `chrome-setup`'s
  `PlatformName` via `EnsureChromeOptions.platform`; `@technical-1/retry`'s
  `RetryOptions` via `navigation`'s `GotoOptions.retry` (a consumer must
  import `RetryOptions` from `@technical-1/retry` directly). Before 1.0, Plan
  09 (or a dedicated pre-release pass) decides per type whether to re-export it
  or keep the cross-package import deliberate. Not a defect — a surface
  decision.
- **Consumer `@types/node` requirement.** `@types/node` is a root devDep, not
  shipped per-package. Packages whose emitted `.d.ts` reference Node types
  (`node:events`, `process`, `node:fs`, etc. — logger/config/chrome-setup/…)
  require the consumer's project to have `@types/node`. Plan 09 must decide how
  to communicate this (README "Requirements" note and/or a `peerDependencies`
  entry) before first publish.
- **Confirm npm org/scope before first publish.** Plan 09 must verify the
  `@technical-1` npm scope/org exists and the auth token has publish access at
  the right tier (scoped public publish) BEFORE the first `changeset publish`
  — add this as an explicit pre-publish checklist item in `release.yml`.
- **CI changeset-status guard.** No CI job verifies a PR includes a changeset.
  Harmless now (solo, plan-driven), but before external contributors or
  parallel plan branches, Plan 09 should add `changeset status --verbose` (or
  the `@changesets/action`) to the pipeline.

## Conventions established in Plan 01 (apply in later plans)

- **Root is ESM.** Root `package.json` has `"type": "module"`; root `.js`
  config files (e.g. `eslint.config.js`) are ESM.
- **`tsup.config.base.ts` re-export is a no-overrides shortcut.** A package
  using `export { default } from "../../tsup.config.base.js"` gets the default
  build only. A package needing a non-default build (extra entries, different
  target) must instead:
  `import { baseTsup } from "../../tsup.config.base.js"; import { defineConfig } from "tsup"; export default defineConfig(baseTsup({ entry: [...] }));`
- **`Logger.log(message, level?)` — `level` is optional by contract.** The
  `core` interface deliberately does NOT impose a default level (a pure
  contract must not). Plan 02's `@technical-1/logger` package owns the
  default-when-omitted semantics: its console + EventEmitter impls MUST define
  and document the behavior for `level === undefined` (recommended default
  `"info"`), so the ~18 consumer packages don't each guess.
- **No dead `eslint-disable` directives.** The flat `eslint.config.js` enables
  only `@typescript-eslint/no-unused-vars` (error) and `no-explicit-any`
  (warn). A disable for any other rule (e.g. `no-constant-condition` on
  `while (true)`) is UNUSED and itself emits a lint warning. Don't add disable
  directives for rules that aren't enabled; the monorepo lints with 0 warnings.
- **Declare `@technical-1/core` only when actually imported.** Spec §4.2's
  "every capability depends on core" presupposes the package *uses* a core
  contract. A capability that genuinely imports a core VALUE
  (`PptrKitError`/subclass, `LOG_LEVELS`) lists core in `dependencies`. One
  that imports only a core TYPE (`LoggerOption`, etc.) lists it in
  `devDependencies` (type-only, erased at emit). A genuinely standalone
  tolerant capability that imports NOTHING from core (e.g. `extract` —
  returns `""`/`[]`, no throws, no logger) has NO core dep at all. Never list
  an unused runtime dep for convention's sake.
- **CJS `export =` deps: use the default import, NOT `import = require`**
  (empirically verified, supersedes the earlier prediction). For a CJS
  `export = X` dep (e.g. `puppeteer-extra-plugin-stealth`; likely the 2captcha
  adapter in Plan 08): `import Foo from "dep"` typechecks cleanly under our
  tsconfig (`esModuleInterop:true` + the package's actual `.d.ts` → TS does
  NOT raise TS1259 for these packages) AND is the only form `vi.mock` can
  intercept. Do NOT use `import Foo = require("dep")` — it compiles to a
  synchronous `require()` that Vitest's ESM mock registry cannot intercept
  (spy receives 0 calls). The matching mock is
  `vi.mock("dep", () => ({ default: spy }))` (a default import receives
  `.default`). If a specific package's `.d.ts` genuinely raises TS1259 with
  the default import, resolve empirically (`import * as Foo`) — verify, don't
  assume. Named-export CJS deps (`puppeteer-extra`'s `addExtra`) import
  normally.
- **Spies used inside a `vi.mock` factory must be created via `vi.hoisted()`.**
  `vi.mock` is hoisted above `const` declarations, so referencing top-level
  `const spy = vi.fn()` from the factory throws a TDZ error. Wrap the spies:
  `const { spy } = vi.hoisted(() => ({ spy: vi.fn() }))`, then reference them
  in both the `vi.mock` factory and the assertions. (Only needed when the test
  asserts on a spy that the factory also returns; inline `vi.fn()` inside the
  factory needs no hoist.)
- **Node typings come from root `@types/node`.** `@types/node` is a ROOT
  devDependency; with NodeNext + no explicit `types` array it is auto-included
  in every package. Packages using Node globals (`setTimeout`, `AbortSignal`,
  `process`, `node:events`, `Buffer`) need NO per-package `lib`/`types`
  override. NEVER add `"DOM"` to a Node package's `lib` (it pollutes globals
  and masks errors). `tsconfig.base.json` stays `lib: ["ES2022"]`.
- **Async fake-timer tests: attach the rejection assertion BEFORE draining.**
  For a promise expected to reject, do
  `const p = fn(); const a = expect(p).rejects.toX(); await vi.runAllTimersAsync(); await a;`
  — never drain timers before the `.rejects` handler is attached, and never
  use `dangerouslyIgnoreUnhandledErrors` (it masks the bug). Resolve-path
  tests can `await vi.runAllTimersAsync()` then `await expect(p).resolves`.
- **Type in-page `evaluate` callbacks with module-scoped `declare var`.**
  `puppeteer-core`'s `evaluate` generic does NOT supply `document`/`window`
  typing, and the base `lib` is `["ES2022"]` (no DOM, deliberately). A src
  file containing `page.evaluate(() => …document…)` declares ONLY the in-page
  globals its callbacks actually use via module-scoped `declare var document
  {…}` / `declare var window {…}` at the top of the file (the file is a module
  — these do NOT leak globally; NOT DOM lib, NOT `@types`). Keep the declared
  shape minimal and accurate to the callback's usage. (Established by
  `interaction-helpers/src/helpers.ts`.)
- **DI-mockable browser pattern (template for all browser-driving packages).**
  A package that drives a browser declares `puppeteer-core` as a bounded peer,
  imports ONLY its types (`import type { Browser, ... }`), and accepts the
  puppeteer instance / `Browser` / `Page` by dependency injection (function
  param). Unit tests inject plain object mocks (`{ launch: vi.fn() }`,
  `{ close: vi.fn() }`) — never real Chrome, never `vi.mock` of
  `puppeteer-core`, never network (spec §9). `src/` carries zero `any`/`as`;
  test mocks may use `as never` at the injection boundary only.
- **Resource-cleanup contract.** A wrapper that owns a browser/page/resource
  closes it on EVERY exit path; the close runs through a quiet helper that
  logs (never throws) so a close failure can neither mask a thrown
  caller error nor discard a successful result (spec §8). (Established by
  `launcher.withBrowser`/`closeQuietly`.)
- **Concurrency primitives reserve synchronously; settle waiters on teardown.**
  Any pool/limiter must reserve its slot SYNCHRONOUSLY before the first
  `await` (no check-then-await TOCTOU — that breaks the bound under
  concurrency), roll the reservation back on launch failure, reject (not
  abandon) queued waiters on `drain()`, and use `Promise.allSettled` +
  `AggregateError` for teardown so one failure never leaks the rest.
  `drain()` is forced-kill (documented); foreign/double-release is ignored.
- **Bound peer-dependency ranges to the validated major.** A peer
  (`puppeteer-core` on `launcher`, and any future peer) must be range-capped to
  the highest major the package is actually built/tested against (e.g.
  `">=22 <25"` since the devDep validates v24). An open-ended `>=N` silently
  admits an unvalidated semver-major for consumers. Widen the cap only in a
  change that explicitly validates the new major.
- **A capability wrapping an external op in `withRetry` defaults
  `isRetryable: () => true`.** Raw `puppeteer-core`/network errors have no
  `.retryable` property, so `withRetry`'s `defaultIsRetryable`
  (`err.retryable === true`) would NEVER retry them — making the wrapper's
  `retry` option useless. Pass `{ ..., isRetryable: () => true, ...opts.retry }`
  (the caller's `opts.retry` spread LAST so it can override). The retry COUNT
  bounds attempts; terminal-ness is expressed by exhaustion → a wrapped typed
  `core` error. (Established by `navigation.goto`.)
- **Wrap external/library errors crossing a package boundary in a core
  error with an explicit `retryable`.** A raw error thrown by `puppeteer-core`,
  `@puppeteer/browsers`, `fs`, the network, etc. has no `.retryable`, so
  `@technical-1/retry`'s `defaultIsRetryable` treats it as terminal. Any
  capability package that calls into an external lib must `try/catch` and
  re-throw `new PptrKitError(msg, { cause, retryable: <true if transient> ,
  context })` — transient I/O/network → `retryable:true`; deterministic
  (bad selector, parse) → `retryable:false`. (Established by
  `chrome-setup.downloadChrome` wrapping `@puppeteer/browsers` install.)
- **Detect/classify suite errors by property, not `instanceof`.** Because
  packages publish dual ESM+CJS, `err instanceof PptrKitError` is unreliable
  across package boundaries. Consumers (especially `@technical-1/retry`)
  branch on `err.retryable === true` (cross-realm-safe retry signal) and
  `err.name` (cross-realm-safe type discriminant). Documented in
  `packages/core/README.md`.
- **Every package ships its own minimal `vitest.config.ts`** (`{ test: {
  include: ["src/**/*.test.ts"], environment: "node" } }`). Required so
  `pnpm --filter <pkg> test` / Turbo's per-package `test` task resolves that
  package's tests from its own directory. The root `vitest.config.ts` still
  drives workspace-wide runs; the two coexist without conflict.
- **Canonical package `exports` map (every package copies this).** tsup dual
  build emits `index.js`/`index.d.ts` (ESM) and `index.cjs`/`index.d.cts`
  (CJS). Use per-condition `types` so CJS consumers get `.d.cts`:
  ```json
  "exports": { ".": {
    "import":  { "types": "./dist/index.d.ts",  "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  } },
  "main": "./dist/index.cjs", "module": "./dist/index.js", "types": "./dist/index.d.ts"
  ```
  A flat top-level `"types"` is wrong (breaks CJS consumers under
  `verbatimModuleSyntax`). Build verification must assert `index.d.cts` exists.
- **Coverage excludes `**/index.ts` globally.** Correct for pure re-export
  barrels. A package that puts real logic in `index.ts` must either move that
  logic to a named module or adjust coverage when coverage is activated
  (Plan 09).
- **Browser-driving packages declare `puppeteer-core` in BOTH `peerDependencies`
  AND `devDependencies`.** `peerDependencies` is the runtime contract with
  consumers (bounded `>=22 <25`); `devDependencies` (a concrete pin like
  `^24.4.0`) is what the package's own `tsup` DTS step uses to resolve
  `import type { ... } from "puppeteer-core"` during build. Without the
  devDep the build fails with `TS2307: Cannot find module 'puppeteer-core'`
  on the first type-only import. Established by every browser-driving
  package shipped so far (`launcher`, `navigation`, `interaction-helpers`,
  `extract`, `proxy`, `fingerprint`, `human`, now `session`).
- **Every package has both a `lint` and a `typecheck` script in addition to
  `build`/`test`.** `lint` is `eslint src` (no `--max-warnings=0` — the
  monorepo-level CI gate enforces zero warnings via the flat ESLint config's
  rule levels). `typecheck` is `tsc --noEmit` and is non-redundant with
  `build`: vitest's transpiler strips types but does NOT strictly check them,
  so without `typecheck` you can ship a file whose `.d.ts` consumers will
  not compile (P6T2 caught a `sourceScheme: "Unsecure"` → `"NonSecure"`
  fixture bug exactly this way). All 15 published packages have the same
  script set: `build`, `typecheck`, `lint`, `test`.
- **Frozen exported tables: `Object.freeze` outside + `Object.freeze<T>` per
  entry.** A package that exports a public read-only constant table
  (e.g. `THROTTLE_PROFILES`) freezes both the wrapper object AND each entry,
  with an explicit generic type parameter on the inner freeze. The inner
  `<T>` (not an `as T` cast) preserves literal narrowing of boolean and
  numeric fields. Double-freeze prevents cross-realm mutation by consumers
  in long-lived processes (the consumer's `Object.freeze` policy is not
  the package's responsibility — defensive immutability is). Established by
  `network.THROTTLE_PROFILES`; expected to apply to any future profile /
  preset / catalog constants (fingerprint pools, captcha profile registries,
  etc.).
- **Sibling-symmetric `package.json` `files: ["dist"]` only.** npm auto-bundles
  the package's `README.md` regardless of what's listed in `files`; an
  explicit `"README.md"` entry is redundant and creates asymmetry with the
  ~14 prior packages. Stay minimal: `"files": ["dist"]`. The README still
  ships.
- **Test-only DI seams use a `*ForTesting` shim, NOT a widened parameter type
  on the public function.** If a function needs injectable hooks for tests
  (e.g. `readdir`/`stat`/`fetch`/`crypto`), DO NOT type the public function's
  `opts` parameter with the wider "Internal" interface — that interface's
  fields land in the published `.d.ts` and consumers see them in
  autocomplete, defeating the privacy. Instead: export a thin wrapper named
  `<fnName>` typed against the narrow public `Options`, which calls a
  separate `export async function <fnName>ForTesting` typed against the
  wider `InternalOptions`. The barrel re-exports ONLY the narrow wrapper;
  tests import `<fnName>ForTesting` directly from the source file. The
  public `.d.ts` then carries only the narrow signature. (Established by
  `downloads.awaitDownload` / `awaitDownloadForTesting` after the Plan 07
  holistic caught the leak.)
- **README code examples MUST match the actual public signature.** A
  positional-args swap (e.g. `awaitDownload(page, dir, fn)` when the real
  signature is `(dir, fn, opts?)`) compiles in markdown but fails on
  first user paste. Before merging a plan, verify each README's import
  destructure and each call-site arity against the implementation. Plan
  07 hit this in `downloads/README.md` — caller had `(page, dir, fn)` for
  what was actually `(dir, fn)`. Verbatim copy from a plan-draft to README
  is fine, but the plan-draft itself must be verified against the
  implementation before the plan goes to execution.
- **Secrets-handling packages ship a sentinel-value leak-guard test.** Any
  package that holds a secret (apiKey, token, oauth refresh-token, etc.)
  must have a test using an obviously-unique sentinel like
  `"SECRET_KEY_DO_NOT_LEAK"`, then assert the sentinel does NOT appear in:
  (a) `console.log` and `console.error` spy call arguments, AND (b) the
  serialized thrown error payload (`name`, `message`, `context`, `stack`).
  This catches both accidental `console.log(apiKey)` and accidental
  `new Error(\`failed with key ${apiKey}\`)` — the latter is the more
  common mistake. Established by `captcha.two-captcha.test.ts` after Plan
  08's security-rigor review pass.

## Plan files

- `2026-05-18-01-packages-foundation-core.md` ← ✅ DONE, merged to `main`
  (Plan 01: monorepo + `@technical-1/core`, 13 tests, dual build verified).
- `2026-05-18-02-utility-tier.md` ← ✅ DONE, merged to `main` (Plan 02:
  `retry`/`logger`/`config`, 26 tests added, 39 monorepo total).
- `2026-05-19-03-browser-foundation.md` ← ✅ DONE, merged to `main` (Plan 03:
  `chrome-setup` + `launcher`, 6 pkgs / 65 tests; cemented the DI-mockable
  browser + bounded-peer + concurrency/cleanup conventions).
- `2026-05-19-04-navigation-data.md` ← ✅ DONE, merged to `main` (Plan 04:
  `interaction-helpers` + `navigation` + `extract`; 9 pkgs / 95 tests).
- `2026-05-19-05-anti-detection.md` ← ✅ DONE, merged to `main` (Plan 05:
  `stealth` + `fingerprint` + `human` + `proxy`; 13 pkgs / 116 tests;
  cemented the empirical CJS-interop convention — default import + `vi.hoisted()`,
  NOT `import = require` — and the `puppeteer-extra` real-dep exception).
- `2026-05-20-06-state-traffic.md` ← ✅ DONE, merged to `main` (Plan 06:
  `session` + `network`; 15 pkgs / 142 tests; cemented the dev+peer
  `puppeteer-core` convention, the `Object.freeze` table convention, the
  `lint`+`typecheck` script convention, and `files: ["dist"]` symmetry.
  `session` uses non-deprecated v24 `page.browserContext().cookies()` path).
- `2026-05-20-07-output-tier.md` ← ✅ DONE, merged to `main` (Plan 07:
  `screenshots` + `pdf` + `downloads`; 18 pkgs / 163 tests; cemented the
  `*ForTesting` shim pattern for DI seams that must NOT leak into the
  published `.d.ts`, plus the "README examples must match the implementation
  signature" verification step. `downloads` uses CDP
  `Browser.setDownloadBehavior` + filesystem polling).
- `2026-05-20-08-captcha.md` ← ✅ DONE, merged to `main` (Plan 08:
  `captcha`; 19 pkgs / 173 tests; cemented the secrets-handling
  sentinel-leak-guard test convention. 2captcha reference adapter via
  direct fetch — no SDK dep, no bundled credentials; apiKey URL-encoded
  and never logged or echoed in error payloads).
- Subsequent plans written iteratively after each predecessor is verified.
- Template plans saved under `Puppeteer-Template/docs/superpowers/plans/`.
