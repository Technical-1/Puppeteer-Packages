---
"@technical-1/chrome-setup": minor
"@technical-1/launcher": minor
---

Browser foundation. `chrome-setup` resolves or downloads a Chrome build via
`resolveChromePath`, `downloadChrome`, and the combining `ensureChrome`.
`launcher` provides `launch`/`withBrowser` (guaranteed cleanup) and a
fixed-size `BrowserPool`. `puppeteer-core` is a peer dependency of `launcher`.
