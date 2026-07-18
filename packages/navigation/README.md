# @technical-1/navigation

`goto` with built-in retry/backoff (via `@technical-1/retry`) and `waitUntil`
strategies, a gesture-triggered navigation helper, plus an SPA network-idle
helper. Failures surface as a `@technical-1/core` `NavigationError`
(navigation) or `TimeoutError` (network-idle) carrying the URL/cause. You
inject the `Page`.

```ts
import { goto, navigateOnGesture, waitForNetworkIdle } from "@technical-1/navigation";

await goto(page, "https://example.test", { waitUntil: "domcontentloaded" });

// Click a link/submit and wait for the navigation it triggers:
const res = await navigateOnGesture(page, () => page.click("a#next"), {
  waitUntil: "load",
});

await waitForNetworkIdle(page);
```

## `navigateOnGesture`

Use this when a navigation is triggered by an in-page action (click, form
submit) rather than a direct `page.goto()` call. It races
`page.waitForNavigation()` against your `gesture` callback under the same
per-attempt timeout and `withRetry` wrapping as `goto`, and resolves to the
`HTTPResponse | null` returned by Puppeteer's navigation wait. Like `goto`, a
caller-cancelled attempt (aborted `retry.signal`) passes through as a
terminal error instead of being rewrapped as retryable; any other surviving
failure is wrapped as a `@technical-1/core` `NavigationError`.

```ts
import { navigateOnGesture } from "@technical-1/navigation";

const response = await navigateOnGesture(
  page,
  () => page.click("button#submit"),
  { waitUntil: "networkidle0", retry: { retries: 2 } },
);
```

## `waitForNetworkIdle`

`NetworkIdleOptions` extend `LoggerOption`: pass a `logger` to receive
`step`/`error` log lines as the helper waits. A network-idle timeout is
wrapped as a `@technical-1/core` `TimeoutError` (retryable) instead of
leaking Puppeteer's own timeout error.

```ts
import { waitForNetworkIdle } from "@technical-1/navigation";

await waitForNetworkIdle(page, { idleTime: 500, timeout: 5000, logger });
```

## Requirements

This package's emitted TypeScript definitions reference `AbortSignal` (via
`GotoOptions.retry: RetryOptions` from `@technical-1/retry`), which is not
part of the `ES2022` lib. Your consumer project must have `@types/node`
installed as a devDependency (or include `"DOM"` in your tsconfig `lib`):

```bash
npm install --save-dev @types/node
# or: pnpm add -D @types/node
```
