# @technical-1 Puppeteer Suite

[![CI](https://github.com/Technical-1/Puppeteer-Packages/actions/workflows/ci.yml/badge.svg)](https://github.com/Technical-1/Puppeteer-Packages/actions/workflows/ci.yml)

**Automate a browser without the boilerplate.** This is a family of 22 small, focused npm packages for driving Chrome with [`puppeteer-core`](https://pptr.dev/) — one for launching a browser, one for navigating with retries, one for pulling data out of the page, one for stealth, one for screenshots, and so on. Pick only the pieces you need, install them from the `@technical-1/*` scope, and skip the pile of copy-pasted helpers that every automation project seems to grow.

Each package does one job well. They share a tiny common `core` — a set of types, a typed error hierarchy, and a logging contract — so the ones you install snap together cleanly instead of fighting each other.

## Why you'll like it

- **Take only what you need.** Just scraping some text? Install `launcher`, `navigation`, and `extract`. Nothing drags in captcha solvers or PDF rendering you'll never call. Everything is tree-shakeable.
- **Errors you can actually branch on.** Every failure is a typed `PptrKitError` (or a subclass like `NavigationError`, `TimeoutError`, or `DownloadError`) that tells you whether it's worth retrying. No more parsing error message strings.
- **Chrome, sorted for you.** One call resolves an existing Chrome install or downloads a fresh stable build — no manual path wrangling, and pinnable when you need reproducibility.
- **Bring your own logging.** Pass any logger and stream structured progress into your console, an event emitter, or a GUI. Pass nothing and it stays quiet. Your automation never assumes where the output goes.
- **Anti-detection building blocks.** Stealth wiring, fingerprints whose user-agent matches the *real* Chrome you're running, geographically-coherent locale/timezone profiles, human-like timing, and proxy helpers — composable, honest, and off by default.
- **Works with `import` and `require`.** Every package ships dual ESM + CJS builds with accurate typings for both, so it just works whichever module system your project uses.

## The packages

| Tier | Packages | What they do |
|------|----------|--------------|
| Foundation | `core`, `retry`, `logger`, `config` | Shared types & errors, backoff/retry, logging, typed config loading |
| Browser | `chrome-setup`, `launcher` | Get a Chrome binary; launch and manage browsers (scoped or pooled) |
| Navigation & data | `navigation`, `interaction-helpers`, `extract`, `dialogs` | Navigate with retries, click/type safely, extract text/tables/schemas, auto-handle JS dialogs |
| Anti-detection | `stealth`, `fingerprint`, `human`, `proxy`, `emulation` | Stealth plugin, realistic fingerprints, human-like timing, proxies, device/viewport emulation |
| State & traffic | `session`, `network` | Capture/restore cookies & storage; block requests, capture responses, throttle |
| Output | `screenshots`, `pdf`, `downloads` | Full-page/element screenshots, PDF rendering, download awaiting |
| Extras | `captcha`, `tabs` | Captcha-solver adapter (2captcha reference); coordinate popups & new tabs |

Every package lives under the `@technical-1/*` scope on npm, each with its own README and its own version.

## Quick start

Install just the packages you need, plus the `puppeteer-core` peer:

```bash
npm install @technical-1/chrome-setup @technical-1/launcher @technical-1/navigation @technical-1/extract puppeteer-core
```

Then get a page and pull something off it:

```ts
import { ensureChrome } from "@technical-1/chrome-setup";
import { withBrowser } from "@technical-1/launcher";
import { goto } from "@technical-1/navigation";
import { extractText } from "@technical-1/extract";
import puppeteer from "puppeteer-core";

const executablePath = await ensureChrome();           // resolve or download Chrome

const title = await withBrowser(puppeteer, { executablePath, headless: true }, async (browser) => {
  const page = await browser.newPage();
  const res = await goto(page, "https://example.com"); // retries + typed errors
  console.log("status:", res?.status());
  return extractText(page, "h1");
});

console.log(title);
```

`withBrowser` guarantees the browser is closed on every exit path, `goto` retries transient failures and throws typed errors on the rest, and `ensureChrome` means you never hand-configure an executable path.

> A few packages emit Node-typed declarations (e.g. `chrome-setup`, `logger`, `navigation`, `retry`). Those note an `@types/node` requirement in their own README.

## Good to know

- **`puppeteer-core` is a peer dependency, never bundled.** Your project owns the single Puppeteer version, so nothing gets double-installed and versions can't conflict. The packages take the `Browser`/`Page` you create as an argument.
- **Anti-detection is opt-in and honest.** These are building blocks, not a guarantee — bot detection is an arms race, and how well they work depends on the target.

## Tech stack

- **Language**: TypeScript (strict, `NodeNext`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`)
- **Runtime peer**: `puppeteer-core` (`>=22 <25`, never a direct dependency)
- **Monorepo**: pnpm workspaces + Turborepo
- **Build**: tsup (dual ESM/CJS + `.d.ts`/`.d.cts`)
- **Test**: Vitest (unit) + a real-Chrome integration tier
- **Release**: Changesets

## Working on the suite

```bash
pnpm install                 # install workspace deps
pnpm turbo run build         # build all packages (dual ESM/CJS)
pnpm turbo run typecheck     # tsc --noEmit across packages
pnpm turbo run lint          # eslint, zero-warning gate
pnpm test                    # unit tests (Vitest, per package)
pnpm coverage                # unit tests + coverage gate (90% thresholds)

# Real-Chrome integration tier (downloads Chrome on first run):
PPTR_IT=1 pnpm --filter @technical-1/integration-tests test
```

## Project structure

```
.
├── packages/            # the 22 published @technical-1/* packages
├── examples/            # one runnable, typecheck-gated demo per package
├── tests/integration/   # real-Chrome tests against a local fixture server (PPTR_IT=1)
├── scripts/             # build helpers
├── tsup.config.base.ts  # shared dual-build config
├── tsconfig.base.json   # shared strict TS config
└── turbo.json           # task pipeline
```

## License

MIT — see [LICENSE](./LICENSE).

## Author

Jacob Kanfer — [GitHub](https://github.com/Technical-1)
</content>
</invoke>
