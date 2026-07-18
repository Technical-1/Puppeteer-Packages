# @technical-1/launcher

Launch a `puppeteer-core` browser with sane defaults and a headless toggle, run
work with guaranteed cleanup, and pool browsers for concurrency.
`puppeteer-core` is a **peer dependency** — you install and own its version;
you pass your `puppeteer` instance in (this package imports only its types).

```ts
import puppeteer from "puppeteer-core";
import { ensureChrome } from "@technical-1/chrome-setup";
import { withBrowser } from "@technical-1/launcher";

// Need a Chrome binary? `npm install @technical-1/chrome-setup` resolves an
// installed Chrome-for-Testing build or downloads one. (Alternatively point
// `executablePath` at a system Chrome or the `PUPPETEER_EXECUTABLE_PATH` env var.)
const executablePath = await ensureChrome();

await withBrowser(puppeteer, { executablePath }, async (browser) => {
  const page = await browser.newPage();
  // ...
});
```

`launch` / `withBrowser` (guaranteed cleanup: the browser is closed on every
exit path, and a close failure never masks the callback error or result) /
`BrowserPool` (fixed-size, lazily created, `drain()` closes everything).
