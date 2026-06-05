# @technical-1/navigation

`goto` with built-in retry/backoff (via `@technical-1/retry`) and `waitUntil`
strategies, plus an SPA network-idle helper. Failures surface as a
`@technical-1/core` `NavigationError` carrying the URL and cause. You inject
the `Page`.

```ts
import { goto, waitForNetworkIdle } from "@technical-1/navigation";

await goto(page, "https://example.test", { waitUntil: "domcontentloaded" });
await waitForNetworkIdle(page);
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
