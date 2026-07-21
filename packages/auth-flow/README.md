# @technical-1/auth-flow

Login-flow orchestration for Puppeteer pages: fill credentials, submit, optional
MFA/OTP step, and wait for the authenticated state — with the suite's typed errors
and DI logger. You inject the `Page` (type-only `puppeteer-core` peer). Errors are
typed `PptrKitError`s from `@technical-1/core`; pass an optional DI `logger`.

```ts
import { login } from "@technical-1/auth-flow";

const { url, mfaPerformed } = await login(page, {
  usernameSelector: "#email",
  username: "alice@example.com",
  passwordSelector: "#password",
  password: process.env.PW!,
  submitSelector: "button[type=submit]",
  authenticated: { urlPredicate: (u) => u.includes("/dashboard") },
  mfa: {
    waitFor: { selector: "#otp" },
    codeSelector: "#otp",
    code: async () => readOtpFromSomewhere(),
    submitSelector: "#otp-submit",
  },
});
```

## Behavior

Fill the username field → fill the password field → click submit → run the optional
MFA step (wait for a challenge-ready state, then type a string-or-async-supplied
code and click its submit button) → wait for the authenticated state. The
authenticated (and MFA-ready) check accepts either a visible `selector` (waited for
via `page.waitForSelector({ visible: true })`) or a Node-side `urlPredicate` polled
against `page.url()`.

## Errors

- A required form-field selector (username, password, submit, or MFA code/submit)
  that never appears throws `SelectorNotFoundError` — terminal, carries `.selector`.
- An authenticated-state or MFA-ready wait that times out throws `TimeoutError` —
  `retryable: true`.

Both are from `@technical-1/core`. Discriminate by `err.name`, never `instanceof`.

## Composition

This package composes primitives you pass — it deliberately does **not** depend on
`@technical-1/interaction-helpers` or `@technical-1/navigation`. Pair it with
`@technical-1/session` to persist the resulting cookies/storage after login.

## v1 limitations

- Single username/password/submit shape — no multi-step username-first flows beyond
  what the MFA step covers.
- The `urlPredicate` poll is Node-side (it does not run in the page).
- No automatic captcha handling — use `@technical-1/captcha`.

## Peer

Requires `puppeteer-core` `>=22 <25`.
