# @technical-1/stealth

Applies `puppeteer-extra-plugin-stealth` to your puppeteer instance — the
standard fingerprint-hardening evasions. You pass your `puppeteer` in; this
package owns `puppeteer-extra` + the stealth plugin as real dependencies (they
ARE the stealth mechanism).

> **Convenience wrapper.** If you already use `puppeteer-extra`, you can apply `puppeteer-extra-plugin-stealth` directly — this package is a typed, one-call (`applyStealth`) convenience so the `@technical-1` suite has a consistent stealth entry point. It adds no evasion logic of its own; all fingerprint hardening comes from `puppeteer-extra-plugin-stealth`. If you only need stealth evasions, you can use that plugin directly.

```ts
import puppeteer from "puppeteer-core";
import { applyStealth } from "@technical-1/stealth";

const stealthPuppeteer = applyStealth(puppeteer);
const browser = await stealthPuppeteer.launch({ executablePath });
```
