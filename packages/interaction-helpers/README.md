# @technical-1/interaction-helpers

Hardened page interaction helpers. Same ergonomics as raw Puppeteer calls but
they throw the typed `@technical-1/core` error hierarchy (e.g.
`SelectorNotFoundError` carrying the selector) instead of opaque timeouts. You
inject the `Page` (this package imports only `puppeteer-core` types).

> **Convenience wrapper.** This package wraps puppeteer-core's `waitForSelector`, `click`, `type`, and related methods with the suite's typed error hierarchy (e.g. `SelectorNotFoundError`) instead of opaque timeouts. It doesn't add new interaction capability beyond those puppeteer-core primitives — it exists so the rest of `@technical-1/*` surfaces actionable, typed errors through one consistent DI seam. If you only need click/type/wait, you can use the puppeteer-core methods directly.

```ts
import { safeClick, waitAndGet } from "@technical-1/interaction-helpers";

await safeClick(page, "button#go");
const heading = await waitAndGet(page, "h1");
```

## Surface

- `safeClick` / `safeType` / `waitAndGet` — wait for a visible selector, then act; throw `SelectorNotFoundError` on a miss. Accept a `Page` **or** a `Frame`.
- `resolveFrame(page, { name | url | selector })` — locate an iframe's `Frame` for frame-scoped interaction.
- `uploadFile(target, selector, files)` — set files on a plain `<input type=file>`. `target` is the injected `Page` or `Frame` (same role as `page` in the other helpers; named `target` because a `Frame` is equally valid).
- `uploadViaFileChooser(page, triggerSelector, files)` — drive a styled upload button through the native file chooser.
- `scroll(page, { by? })` — single scroll (to bottom, or by N px). `autoScroll(page, { maxScrolls?, step?, settleMs?, itemSelector? })` — loop until lazy content stops growing.
- `pressKey(page, key)` / `pressShortcut(page, modifiers, key)` — press Enter/Escape/Tab or a Ctrl/Cmd/Shift/Alt + key combo.
- `waitForFunction(page, fn, { timeout?, polling?, args? })` — poll an in-page predicate until truthy, resolving its `JSHandle`; throws `TimeoutError` on a poll timeout. Accepts a `Page` **or** a `Frame`.
- `readClipboard(page)` / `writeClipboard(page, text)` — read/write the clipboard via `navigator.clipboard`, granting the clipboard permission on the page's own origin. Requires a secure `http(s)` origin (throws `ConfigError` on `about:blank`/`file:`).

All helpers take an optional injected `logger` and emit a `"step"` log line; all thrown failures are `@technical-1/core` typed errors.

### Iframe-scoped interaction

`safeClick` / `safeType` / `waitAndGet` / `scroll` / `autoScroll` / `uploadFile`
accept a `Page` or a `Frame`, so resolve the frame once and interact within it:

```ts
import { resolveFrame, safeClick } from "@technical-1/interaction-helpers";

const frame = await resolveFrame(page, { name: "checkout" });
// or: { url: /stripe\.com/ } or { selector: "iframe#payment" }
await safeClick(frame, "button#pay");
```

### File uploads

```ts
import {
  uploadFile,
  uploadViaFileChooser,
} from "@technical-1/interaction-helpers";

// Plain hidden <input type=file> (Page or Frame):
await uploadFile(page, "input[type=file]", "./avatar.png");

// Styled button backed by the native file chooser:
await uploadViaFileChooser(page, "button#upload", [
  "./a.pdf",
  "./b.pdf",
]);
```

### Infinite scroll

```ts
import { autoScroll } from "@technical-1/interaction-helpers";

// Loop until the item count stops growing (or maxScrolls is hit):
const iterations = await autoScroll(page, {
  itemSelector: ".feed-item",
  maxScrolls: 20,
  settleMs: 800,
});
```

### Keyboard

```ts
import { pressKey, pressShortcut } from "@technical-1/interaction-helpers";

await pressKey(page, "Enter");
await pressShortcut(page, "Control", "KeyA"); // Ctrl+A
await pressShortcut(page, ["Meta", "Shift"], "KeyZ"); // Cmd+Shift+Z
```

### Wait for a predicate / clipboard

```ts
import { waitForFunction, readClipboard, writeClipboard } from "@technical-1/interaction-helpers";

await waitForFunction(page, () => document.querySelectorAll(".row").length >= 10, {
  timeout: 10_000,
  polling: "mutation",
});

await writeClipboard(page, "prefilled");
const copied = await readClipboard(page); // e.g. verify a "copy link" button
```
