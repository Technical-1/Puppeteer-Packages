# @technical-1/stealth

Applies `puppeteer-extra-plugin-stealth` to your puppeteer instance — the
standard fingerprint-hardening evasions. You pass your `puppeteer` in; this
package owns `puppeteer-extra` + the stealth plugin as real dependencies (they
ARE the stealth mechanism).

```ts
import puppeteer from "puppeteer-core";
import { applyStealth } from "@technical-1/stealth";

const stealthPuppeteer = applyStealth(puppeteer);
const browser = await stealthPuppeteer.launch({ executablePath });
```
