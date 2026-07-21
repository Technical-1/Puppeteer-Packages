# @technical-1/auth-flow

## 1.1.0

### Minor Changes

- 5718ac1: Add `@technical-1/auth-flow`: login-flow orchestration for Puppeteer pages.
  `login(page, steps, options)` fills the username and password fields, clicks submit,
  runs an optional MFA/OTP step (wait for a challenge-ready state, then type a
  string-or-async-supplied code and submit), and waits for the authenticated state —
  either a visible `selector` or a Node-side `urlPredicate` polled against `page.url()`.
  A required form-field selector that never appears throws `SelectorNotFoundError`; an
  authenticated-state or MFA-ready wait that times out throws a retryable `TimeoutError`
  (both from `@technical-1/core`). Composes only caller-supplied primitives — it does not
  depend on any other capability package — and takes an optional DI logger.

### Patch Changes

- Updated dependencies [c1b1c0c]
- Updated dependencies [122c871]
- Updated dependencies [34f2973]
  - @technical-1/core@1.1.0
