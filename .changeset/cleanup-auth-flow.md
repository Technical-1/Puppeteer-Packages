---
"@technical-1/auth-flow": patch
---

Reject a half-specified MFA step with a non-retryable `ConfigError` instead of silently succeeding: supplying only one of `code`/`codeSelector`, or a `submitSelector` without both, is now a caller error rather than a no-op that still reports `mfaPerformed: true`.
