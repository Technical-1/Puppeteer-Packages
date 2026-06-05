---
---

(Plan 09 — publish-prep, no version bumps.)

This branch ships the release infrastructure for the @technical-1 suite:
- Per-package examples under `examples/`.
- Integration tier under `tests/integration/`, gated by `PPTR_IT=1`.
- `.github/workflows/release.yml` Changesets publish pipeline.
- tsup sourcemap dedup, SHA-pinned actions, `workspace:^` internal-dep range, changeset-status CI guard, `@types/node` consumer notes.

The first `release.yml` run after this branch merges will bump all 19 published packages 0.0.0 → 0.1.0 and ship to npm.
