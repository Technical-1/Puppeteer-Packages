# @technical-1/chrome-setup

Resolve an existing Chrome-for-Testing build, or download one via
`@puppeteer/browsers`. Environment-agnostic — no Electron/bundler assumptions
(packaged-app resolution is a template concern, not this package's).

```ts
import { ensureChrome } from "@technical-1/chrome-setup";

const executablePath = await ensureChrome();
```

- `resolveChromePath(opts?)` — pure, synchronous; searches known cache
  directories, returns a path or `undefined`.
- `downloadChrome(opts?)` — downloads a pinned Chrome build, returns its
  `executablePath`.
- `ensureChrome(opts?)` — resolve, else download; throws a core `PptrKitError`
  if Chrome cannot be made available.
