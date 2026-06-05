# @technical-1/examples

One runnable demo per published package. Not published to npm. Typecheck-gated
by CI; manually runnable via `pnpm tsx examples/src/<name>.example.ts`.

These exist primarily as API-drift detectors — if a published package's public
surface changes in a breaking way, the corresponding example fails to typecheck,
surfacing the breakage in CI.
