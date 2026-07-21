# @technical-1/cdp

> **Advanced escape hatch.** A typed, error-wrapped escape hatch to the raw Chrome
> DevTools Protocol — open a session from a `Page` or `Target`, `send` any typed CDP
> command, subscribe to any CDP event, and detach safely. It exists because the suite's
> own CDP uses (downloads, network throttling) are single-purpose and internal; this
> package unlocks any *other* CDP domain (`Emulation.setGeolocationOverride`,
> `Storage.*`, `Target.*`, `Security.*`, …) with the suite's typed errors.

```ts
import { withCdpSession } from "@technical-1/cdp";

const version = await withCdpSession(page, (session) =>
  session.send("Browser.getVersion"),
);
```

```ts
import { openCdpSession } from "@technical-1/cdp";

const session = await openCdpSession(page);
const off = session.on("Target.targetCreated", (e) => console.log(e.targetInfo));
await session.send("Target.setDiscoverTargets", { discover: true });
// ... later ...
off();
await session.detach();
```

## Prefer `withCdpSession`

`withCdpSession`'s `finally` guarantees `detach()` so a CDP handle is never leaked,
even when `fn` throws. Reach for `openCdpSession` only when the session must outlive a
single function scope — and then you own calling `detach()`.

## `raw` escape hatch

`session.raw` is the underlying puppeteer-core `CDPSession` for anything the thin
wrapper omits (`once`, `listenerCount`, `id()`).

## Errors

All failures — open, `send`, `detach` — surface as `CdpError` from `@technical-1/core`.
`open`/`send` are `retryable:true` (transient closed-session failures); `detach` is
`retryable:false`. Discriminate by `err.name === "CdpError"`, never `instanceof`
(cross-realm-safe). `send` failures carry `context.method`.

## v1 limitations

- One thin wrapper per handle.
- `on` only supports `on`/`off` (use `session.raw.once` for one-shot).
- No session pooling/reuse across calls — open one per scope.

A deliberately small surface.

## Peer

Requires `puppeteer-core` `>=22 <25` (peer dependency). puppeteer-core is used for
**types only** — no runtime value import.
