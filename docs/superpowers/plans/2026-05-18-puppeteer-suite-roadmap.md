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

- **Internal-dep range strategy.** `.changeset/config.json` has
  `updateInternalDependencies: "patch"`, so on publish Changesets pins internal
  `workspace:*` deps (e.g. `@technical-1/retry` → `@technical-1/core`) to an
  exact resolved version, not a caret range. Consumers won't auto-satisfy a
  newer `core` without an explicit dependent release. Plan 09 must consciously
  confirm or change this before the first `changeset publish`.

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

## Plan files

- `2026-05-18-01-packages-foundation-core.md` ← ✅ DONE, merged to `main`
  (Plan 01: monorepo + `@technical-1/core`, 13 tests, dual build verified).
- `2026-05-18-02-utility-tier.md` ← detailed, ready to execute (Plan 02:
  `retry` + `logger` + `config`).
- Subsequent plans written iteratively after each predecessor is verified.
- Template plans saved under `Puppeteer-Template/docs/superpowers/plans/`.
