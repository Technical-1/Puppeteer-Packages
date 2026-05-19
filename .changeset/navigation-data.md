---
"@technical-1/interaction-helpers": minor
"@technical-1/navigation": minor
"@technical-1/extract": minor
---

Navigation & data tier: `interaction-helpers` (hardened
`safeClick`/`safeType`/`waitAndGet`/`scroll` throwing typed core errors),
`navigation` (`goto` with retry + `waitForNetworkIdle`), and `extract`
(`extractText`/`extractAll`/`extractTable`/`extractSchema` DOM extraction).
All declare `puppeteer-core` as a peer. `navigation` is the first capability
package to depend on an internal utility (`@technical-1/retry`) in addition to
`core`. `extract` is standalone — no `@technical-1/core` dependency (returns
`""`/`[]`, never throws typed errors).
