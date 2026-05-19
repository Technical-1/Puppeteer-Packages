---
"@technical-1/interaction-helpers": minor
"@technical-1/navigation": minor
"@technical-1/extract": minor
---

Navigation & data tier: `interaction-helpers` (hardened
`safeClick`/`safeType`/`waitAndGet`/`scroll` throwing typed core errors),
`navigation` (`goto` with retry + `waitForNetworkIdle`), and `extract`
(`extractText`/`extractAll`/`extractTable`/`extractSchema` DOM extraction).
All declare `puppeteer-core` as a peer.
