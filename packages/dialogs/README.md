# @technical-1/dialogs

Page-lifecycle JS dialog handler (alert/confirm/prompt/beforeunload) with an accept/dismiss policy for Puppeteer pages.

> **Convenience wrapper.** This package wraps puppeteer-core's `page.on('dialog', …)` with a typed accept/dismiss policy, prompt-text supply, typed events, and the suite's typed errors (`PptrKitError`). It adds no capability beyond the raw `'dialog'` event — it exists so a single unhandled `confirm()`/`beforeunload` never silently stalls a suite-driven flow, and so responses compose through one consistent, typed surface.

```ts
import { handleDialogs } from "@technical-1/dialogs";

// Dismiss everything (the default) for the page's lifetime:
const dialogs = handleDialogs(page);

// Accept confirms, answer prompts, keep dismissing alerts:
const dialogs2 = handleDialogs(page, {
  defaultAction: "dismiss",
  policy: {
    confirm: { action: "accept" },
    prompt: { action: "accept", promptText: "automated" },
    beforeunload: { action: "accept" },
  },
  onDialog: (e) => console.log(`${e.action} ${e.type}: ${e.message}`),
  onError: (err) => console.error(err.message),
});

// ... run your flow ...

console.log(dialogs2.handled); // readonly DialogEvent[]
dialogs2.dispose();            // detach the listener (idempotent)
```

## Policy

- `defaultAction` — `"accept"` or `"dismiss"` for any kind not named in `policy`. Default `"dismiss"`.
- `policy` — per-kind `{ action, promptText? }` overrides for `alert` / `confirm` / `prompt` / `beforeunload`.
- `promptText` — fallback text entered when accepting a `prompt` and its rule supplies none. Ignored for non-prompt kinds; when omitted, Chrome uses the prompt's default value.

## v1 limitations

- One policy per handler for the page's lifetime — no per-URL or per-message routing (compose your own `onDialog` logic, or dispose and re-attach with a new policy).
- `handleDialogs` returns synchronously and attaches a single `'dialog'` listener; multiple concurrent handlers on one page all fire (puppeteer allows multiple listeners), so attach one.

## Errors

Response failures (e.g. the page closed before the dialog was answered) are surfaced as
`PptrKitError` from `@technical-1/core` with `retryable:true`, delivered to the `onError` callback and
the injected `logger` at level `error` — never thrown (the handler runs inside an event listener).

## Peer

Requires `puppeteer-core` `>=22 <25`.
