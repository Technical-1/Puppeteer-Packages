/**
 * @technical-1/retry — withRetry demo
 *
 * Shows the exponential-backoff retry wrapper with a flaky async function and
 * the RetryOptions shape (retries, minDelayMs, maxDelayMs, factor, jitter).
 *
 * Run: pnpm tsx examples/src/retry.example.ts
 */

import { withRetry } from "@technical-1/retry";
import type { RetryOptions } from "@technical-1/retry";
import { PptrKitError } from "@technical-1/core";
import { createConsoleLogger } from "@technical-1/logger";

// A "flaky" function that fails on attempts 1–2 then succeeds on attempt 3.
let callCount = 0;
async function flaky(attempt: number): Promise<string> {
  callCount += 1;
  if (attempt < 3) {
    throw new PptrKitError("transient failure", { retryable: true });
  }
  return `succeeded on attempt ${attempt}`;
}

const opts: RetryOptions = {
  retries: 4,
  minDelayMs: 10,
  maxDelayMs: 100,
  factor: 2,
  jitter: false,
  logger: createConsoleLogger({ minLevel: "warn" }),
};

const result = await withRetry(flaky, opts);
console.log(result);
// => succeeded on attempt 3
console.log("total calls:", callCount);
// => total calls: 3

// Non-retryable errors propagate immediately
try {
  await withRetry(
    async () => {
      throw new PptrKitError("terminal", { retryable: false });
    },
    { retries: 5 },
  );
} catch (err) {
  const e = err as PptrKitError;
  console.log("non-retryable rethrown:", e.message);
  // => non-retryable rethrown: terminal
}
