# @technical-1/launcher

Launch a `puppeteer-core` browser with sane defaults and a headless toggle, run
work with guaranteed cleanup, and pool browsers for concurrency.
`puppeteer-core` is a **peer dependency** — you install and own its version;
you pass your `puppeteer` instance in (this package imports only its types).

```ts
import puppeteer from "puppeteer-core";
import { withBrowser } from "@technical-1/launcher";

await withBrowser(puppeteer, { executablePath }, async (browser) => {
  const page = await browser.newPage();
  // ...
});
```

`launch` / `withBrowser` (guaranteed cleanup: the browser is closed on every
exit path, and a close failure never masks the callback error or result) /
`BrowserPool` (fixed-size, lazily created, `drain()` closes everything).
