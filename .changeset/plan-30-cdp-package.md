---
"@technical-1/cdp": minor
---

New package: a generic CDPSession escape hatch. `openCdpSession(source)` opens a
typed, error-wrapped session from a Page or Target; `withCdpSession(source, fn)`
runs a scope with a guaranteed `detach()` in finally. Thin `send` / `on` / `detach`
wrapper over puppeteer-core's `CDPSession`, with failures surfaced as `CdpError`.
