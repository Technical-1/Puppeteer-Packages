# @technical-1/core

Foundational package for the `@technical-1` Puppeteer capability suite. Zero
runtime dependencies. Every capability package depends on this for shared
contracts.

Exports:

- **Typed error hierarchy** — `PptrKitError` (base) and
  `SelectorNotFoundError`, `NavigationError`, `TimeoutError`, `CaptchaError`,
  `ProxyError`, `SessionError`, `ConfigError`, `PoolError`, `DownloadError`,
  `NetworkError`, `AbortError`. Each carries a `retryable` flag and a
  structured `context`.
- **`Logger` interface** — the dependency-injected logging contract. No
  implementation lives here (see `@technical-1/logger`).
- **Shared option shapes** — `LoggerOption`, `TimeoutOption`.

```ts
import { SelectorNotFoundError, type Logger } from "@technical-1/core";
```

## Detecting suite errors across packages

This package is published in both ESM and CommonJS form. In mixed
ESM/CJS deployments a consumer can end up with two copies of the
constructors, so `err instanceof PptrKitError` is **not reliable across
package boundaries**. Detect and classify suite errors by the stable
**properties** instead — this is the contract `@technical-1/retry` and
other consumers rely on:

```ts
function isRetryable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "retryable" in err &&
    (err as { retryable?: unknown }).retryable === true
  );
}
```

`err.name` (e.g. `"NavigationError"`) is the cross-realm-safe discriminant
for the specific error type; `err.retryable` is the cross-realm-safe
retry signal.

`AbortError` (`name === "AbortError"`, `retryable: false`) is the
cross-realm-safe cancellation discriminant: when an operation is cancelled
via an `AbortSignal`, consumers detect it by name rather than by matching
the message string.
