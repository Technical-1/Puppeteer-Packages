# @technical-1 Puppeteer Suite

A monorepo of small, focused, independently-versioned npm packages for browser automation with [`puppeteer-core`](https://pptr.dev/). Each package does one thing — launch a pooled browser, navigate with retries, extract data, apply stealth, capture a screenshot or PDF, solve a captcha — and they compose cleanly because they share one tiny `core` of types, a typed error hierarchy, and a dependency-injected `Logger` contract.

I built this to turn a pile of copy-pasted Puppeteer helpers into a real library: tree-shakeable packages you install à la carte, with `puppeteer-core` as a peer dependency (never bundled), dual ESM + CJS output, and ~100% tested logic.

## Features

- **À-la-carte packages** — install only what you need (`@technical-1/launcher`, `@technical-1/navigation`, …); they interoperate through a shared `core` contract.
- **Typed error hierarchy** — every failure is a `PptrKitError` (or subclass) carrying a `retryable` flag and structured `context`; detection is cross-realm-safe (by `.name`/`.retryable`, not `instanceof`).
- **Dependency-injected everything** — packages accept a `Page`/`Browser` and an optional `Logger`; they never reach for a global, so they unit-test against plain object mocks and stream logs into any UI.
- **Resource-safe by construction** — wrappers that own a browser/page close it on every exit path; the pool reserves slots synchronously to hold its concurrency bound under load.
- **Anti-detection building blocks** — stealth plugin wiring, fingerprints whose UA tracks the *actual* running Chrome, geographically-coherent locale/timezone profiles, human-like timing, and proxy helpers.
- **Output helpers** — screenshots, PDFs (per-side margin defaults), and a CDP-based download awaiter.
- **Dual ESM + CJS** — correct `exports` map with per-condition types (`.d.ts` / `.d.cts`) so both `import` and `require` consumers get accurate typings.

## Packages

| Tier | Packages |
|------|----------|
| Core | `core` |
| Utility | `retry`, `logger`, `config` |
| Browser foundation | `chrome-setup`, `launcher`, `tabs` |
| Navigation & data | `navigation`, `interaction-helpers`, `extract`, `dialogs` |
| Anti-detection | `stealth`, `fingerprint`, `human`, `proxy`, `emulation` |
| State & traffic | `session`, `network` |
| Output | `screenshots`, `pdf`, `downloads` |
| Captcha | `captcha` |

## Tech Stack

- **Language**: TypeScript (strict, `NodeNext`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`)
- **Runtime peer**: `puppeteer-core` (bounded range, never a direct dependency)
- **Monorepo**: pnpm workspaces + Turborepo
- **Build**: tsup (dual ESM/CJS + `.d.ts`/`.d.cts`)
- **Test**: Vitest (unit) + a real-Chrome integration tier
- **Release**: Changesets

## Getting Started

### Install

Install the packages you need plus the `puppeteer-core` peer:

```bash
npm install @technical-1/launcher @technical-1/navigation puppeteer-core
```

### Usage

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

> Packages that emit Node-typed declarations (e.g. `chrome-setup`, `logger`, `navigation`, `retry`) note an `@types/node` requirement in their own README.

## Development

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

## Project Structure

```
.
├── packages/            # the 19 published @technical-1/* packages
├── examples/            # one runnable, typecheck-gated demo per package
├── tests/integration/   # real-Chrome tests against a local fixture server (PPTR_IT=1)
├── scripts/             # build helpers (sourcemap dedup, action SHA-pinning notes)
├── tsup.config.base.ts  # shared dual-build config
├── tsconfig.base.json   # shared strict TS config
└── turbo.json           # task pipeline
```

## License

MIT — see [LICENSE](./LICENSE).

## Author

Jacob Kanfer — [GitHub](https://github.com/Technical-1)
