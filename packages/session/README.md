# @technical-1/session

Capture and restore browser session state — cookies, localStorage,
sessionStorage — with an in-memory label-keyed store for multi-account
workflows.

```ts
import { captureSession, restoreSession, Session } from "@technical-1/session";

// Pure form:
const snap = await captureSession(page);
await restoreSession(otherPage, snap);

// With store:
const store = new Session();
await store.save(page, "alice");
await store.load(otherPage, "alice");
```

## v1 limitations

- Captures cookies + localStorage + sessionStorage only. Does NOT capture:
  IndexedDB, Cache API, Service Workers, in-memory JS state. Adequate for the
  dominant "reuse a login cookie / token-in-localStorage" use case.
- `restoreSession` applies storage via `evaluateOnNewDocument` — the storage
  is present before the next navigation. Browsers scope storage to origin, so
  the caller must navigate to a matching origin to observe it.

## Errors

Throws `SessionError` from `@technical-1/core` (terminal — `retryable: false`)
on capture/restore failures with the underlying `cause` attached.

## Peer

Requires `puppeteer-core` `>=22 <25`.
