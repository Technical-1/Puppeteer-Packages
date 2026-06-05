# @technical-1/pdf

Page → PDF helper with sane defaults for Puppeteer pages.

```ts
import { pageToPdf } from "@technical-1/pdf";

// Buffer return:
const pdfBytes = await pageToPdf(page, { format: "A4", printBackground: true });

// Write to disk:
await pageToPdf(page, { path: "./report.pdf", format: "Letter" });
```

## Defaults

If no options are passed, the helper sends `{ format: "A4", printBackground: true, margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" } }` — chosen as defensible "looks-like-a-document" defaults. Callers override top-level fields freely.

### Margins

`pageToPdf` deep-merges the `margin` object per side over a 1cm default. A
partial margin keeps the unspecified sides at 1cm:

`pageToPdf(page, { margin: { top: "2cm" } })`
→ `{ top: "2cm", bottom: "1cm", left: "1cm", right: "1cm" }`

(Pass all four sides explicitly to override every margin.)

## Errors

Throws `PptrKitError` from `@technical-1/core` wrapping puppeteer-core
failures. Typically `retryable:true` (transient page state); a closed-page
failure may need a fresh page from the caller.

## Peer

Requires `puppeteer-core` `>=22 <25`.
