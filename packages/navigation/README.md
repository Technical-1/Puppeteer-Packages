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
