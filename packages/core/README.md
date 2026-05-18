# @technical-1/core

Foundational package for the `@technical-1` Puppeteer capability suite. Zero
runtime dependencies. Every capability package depends on this for shared
contracts.

Exports:

- **Typed error hierarchy** — `PptrKitError` (base) and
  `SelectorNotFoundError`, `NavigationError`, `TimeoutError`, `CaptchaError`,
  `ProxyError`, `SessionError`. Each carries a `retryable` flag and a
  structured `context`.
- **`Logger` interface** — the dependency-injected logging contract. No
  implementation lives here (see `@technical-1/logger`).
- **Shared option shapes** — `LoggerOption`, `TimeoutOption`.

```ts
import { SelectorNotFoundError, type Logger } from "@technical-1/core";
```
