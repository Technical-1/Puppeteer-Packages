# @technical-1/fingerprint

Randomize (or pin) a browser fingerprint — user agent, viewport, locale,
timezone — and apply it to a `Page`. You inject the `Page` (type-only
`puppeteer-core` peer). No `@technical-1/core` dependency.

```ts
import { randomFingerprint, applyFingerprint } from "@technical-1/fingerprint";

const fp = randomFingerprint();
await applyFingerprint(page, fp);
```
