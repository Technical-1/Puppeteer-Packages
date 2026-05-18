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

## Plan files

- `2026-05-18-01-packages-foundation-core.md` ← detailed, ready to execute
- Subsequent plans written iteratively after each predecessor is verified.
- Template plans saved under `Puppeteer-Template/docs/superpowers/plans/`.
