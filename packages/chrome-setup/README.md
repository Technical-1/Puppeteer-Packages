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
- `downloadChrome(opts?)` — downloads Chrome (latest stable by default, or a
  pinned build if `buildId` is supplied), returns its `executablePath`.
- `ensureChrome(opts?)` — resolve, else download; throws a core `PptrKitError`
  if Chrome cannot be made available.

### Chrome version

`ensureChrome`/`downloadChrome` install the **latest stable** Chrome by default
(resolved at install time), so fresh installs stay current. For reproducible
installs, pass an explicit `buildId` (the pinned `DEFAULT_CHROME_BUILD` is
exported for this purpose):

`ensureChrome({ buildId: DEFAULT_CHROME_BUILD })`

If stable resolution fails (offline), it falls back to `DEFAULT_CHROME_BUILD`.

## Requirements

This package's emitted TypeScript definitions reference Node's built-in types
(`NodeJS.Platform`, `process.platform`). **If you consume this package from
TypeScript**, install `@types/node` as a devDependency. Plain-JavaScript
consumers can skip this entirely:

```bash
npm install --save-dev @types/node
# or: pnpm add -D @types/node
```
