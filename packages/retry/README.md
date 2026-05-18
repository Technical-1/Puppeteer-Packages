# @technical-1/retry

Generic async retry with exponential backoff and jitter. Retry-vs-terminal is
decided by the **property** contract from `@technical-1/core` (an error's
`retryable === true`), never by `instanceof` — safe across the dual ESM/CJS
package boundary.

```ts
import { withRetry } from "@technical-1/retry";

const html = await withRetry(() => fetchPage(url), { retries: 4 });
```

`withRetry(fn, opts?)` calls `fn(attempt)` (1-based). On a thrown error it
retries iff `opts.isRetryable(err)` is true (default: `err?.retryable === true`)
and attempts remain; otherwise it rethrows. Delays grow
`minDelayMs * factor^(attempt-1)`, capped at `maxDelayMs`, optionally jittered.
An `AbortSignal` cancels pending waits.
