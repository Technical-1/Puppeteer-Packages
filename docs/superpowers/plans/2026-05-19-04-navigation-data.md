# Navigation & Data (`navigation`, `interaction-helpers`, `extract`) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the three page-interaction capability packages —
`@technical-1/interaction-helpers` (`safeClick`/`safeType`/`waitAndGet`/
`scroll`, ported & hardened from the seeded Kanfer `helpers.js` to throw typed
`core` errors), `@technical-1/navigation` (`goto` wrapped in
`@technical-1/retry`, `waitForNetworkIdle`), and `@technical-1/extract`
(list/table/schema extraction) — fully built, tested, changeset-versioned.

**Architecture:** Three workspace packages, each depending on
`@technical-1/core` (`workspace:*`) and declaring the bounded `puppeteer-core`
peer (`>=22 <25`) + matching devDep. `navigation` additionally depends on
`@technical-1/retry` (`workspace:*`) — a capability→utility dep, allowed by
spec §4.2 (no capability↔capability cross-deps). All three follow the
**DI-mockable browser pattern** cemented by `launcher`: import ONLY
`puppeteer-core` types (`import type { Page }`), take the `Page` by dependency
injection, and unit-test with plain mock `Page` objects (the Kanfer
`helpers.test.js` `mockPage` pattern) — no real Chrome, no network (spec §9).
Hardening = the Kanfer helpers' generic `throw new Error(...)` becomes the
typed `core` hierarchy (`SelectorNotFoundError` carrying the selector). The
`extract` package uses `page.evaluate` (not Puppeteer's `$`-prefixed eval
helpers) for a single, uniformly-mockable extraction primitive.

**Tech Stack:** TypeScript (NodeNext, strict, verbatimModuleSyntax), tsup,
vitest. `puppeteer-core` types only (peer). `@technical-1/retry` for navigation.

**Working dir:** `/Users/jacobkanfer/Desktop/Code/Puppeteer-Packages`
(execution on `feat/04-navigation-data`, branched from `main` at the Plan 03
tip). Authorship `Jacob Kanfer <kanfer@users.noreply.github.com>` (configured;
never `--author`).

**Invariants (roadmap — verify every task):** prohibited brand string (spec
§3) never appears; canonical per-condition `exports` map; per-package minimal
`vitest.config.ts`; root `@types/node` (no per-pkg `lib`/`DOM`); no dead
`eslint-disable`; typed `core` errors (`SelectorNotFoundError` etc.; base
`PptrKitError` with `context` where no subclass fits); function-first APIs;
DI-mockable `Page` (type-only peer import, inject `Page`, mock in tests; `src/`
zero `any`/`as`, test mocks may `as unknown as Page` at the injection
boundary only); wrap external/`page.*` failures in a `core` error with the
right `retryable`; **mocks only — no real Chrome / no network** (spec §9, §12).

---

## Canonical package skeleton (Tasks 1/4/7 use verbatim)

Identical to Plan 03. `packages/<pkg>/package.json` — **dependency blocks
differ per package, stated in each scaffold task**:

```json
{
  "name": "@technical-1/<pkg>",
  "version": "0.0.0",
  "description": "<description>",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  }
}
```

`tsconfig.json` / `tsup.config.ts` / `vitest.config.ts` / placeholder
`src/index.ts` are byte-identical to the Plan 03 skeleton:

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": "src", "outDir": "dist" }, "include": ["src/**/*.ts"] }
```
```ts
export { default } from "../../tsup.config.base.js";
```
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```
```ts
export {};
```

The `puppeteer-core` peer+dev block (used by all 3 packages here):

```json
  "peerDependencies": { "puppeteer-core": ">=22 <25" },
  "devDependencies": { "puppeteer-core": "^24.4.0" }
```

---

### Task 1: `@technical-1/interaction-helpers` scaffold

**Files:** `packages/interaction-helpers/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1:** Create the 5 skeleton files. `<pkg>`=`interaction-helpers`,
  `<description>`=`Hardened safeClick/safeType/waitAndGet/scroll page helpers throwing typed @technical-1/core errors`.
  `dependencies` block:

```json
  "dependencies": { "@technical-1/core": "workspace:*" },
  "peerDependencies": { "puppeteer-core": ">=22 <25" },
  "devDependencies": { "puppeteer-core": "^24.4.0" }
```

- [ ] **Step 2:** Create `packages/interaction-helpers/README.md`:

```markdown
# @technical-1/interaction-helpers

Hardened page interaction helpers. Same ergonomics as raw Puppeteer calls but
they throw the typed `@technical-1/core` error hierarchy (e.g.
`SelectorNotFoundError` carrying the selector) instead of opaque timeouts. You
inject the `Page` (this package imports only `puppeteer-core` types).

```ts
import { safeClick, waitAndGet } from "@technical-1/interaction-helpers";

await safeClick(page, "button#go");
const heading = await waitAndGet(page, "h1");
```

`safeClick` / `safeType` / `waitAndGet` / `scroll`.
```

- [ ] **Step 3:** `pnpm install && pnpm -r list --depth -1` → succeeds; lists
  `@technical-1/interaction-helpers`; core workspace-linked; puppeteer-core
  present (dev+peer). Quote any pnpm peer notice (expected/fine).

- [ ] **Step 4:** Commit:

```bash
git add -A
git commit -m "chore(interaction-helpers): scaffold @technical-1/interaction-helpers"
```

---

### Task 2: `@technical-1/interaction-helpers` implementation (TDD)

**Files:** Create `packages/interaction-helpers/src/helpers.ts`; Test
`packages/interaction-helpers/src/helpers.test.ts`.

Ported from the seeded Kanfer `Puppeteer-Template/automation/helpers.js`
(`safeClick`/`safeType`/`waitAndGet`/`scroll`; the Kanfer `screenshot` helper
is deferred to Plan 07's `screenshots` package — NOT here), hardened: a
`waitForSelector` failure throws `SelectorNotFoundError(selector)` (carries
the selector, `retryable:false`) instead of a generic `Error`. The Kanfer
`helpers.test.js` `mockPage` pattern is the test basis.

- [ ] **Step 1: Write the failing test** `packages/interaction-helpers/src/helpers.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { safeClick, safeType, waitAndGet, scroll } from "./helpers.js";
import { SelectorNotFoundError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    waitForSelector: vi.fn().mockResolvedValue(true),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Page;
}

describe("safeClick", () => {
  it("waits for the visible selector then clicks", async () => {
    const page = mockPage();
    await safeClick(page, "#btn");
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#btn",
      expect.objectContaining({ visible: true }),
    );
    expect(page.click).toHaveBeenCalledWith("#btn");
  });

  it("throws SelectorNotFoundError (carrying the selector) when not found", async () => {
    const page = mockPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(safeClick(page, "#missing")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
    await expect(safeClick(page, "#missing")).rejects.toMatchObject({
      selector: "#missing",
    });
  });
});

describe("safeType", () => {
  it("waits then types with the given delay", async () => {
    const page = mockPage();
    await safeType(page, "#in", "abc", { delay: 10 });
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#in",
      expect.objectContaining({ visible: true }),
    );
    expect(page.type).toHaveBeenCalledWith("#in", "abc", { delay: 10 });
  });

  it("throws SelectorNotFoundError when the field is absent", async () => {
    const page = mockPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(safeType(page, "#x", "y")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });
});

describe("waitAndGet", () => {
  it("returns the trimmed text content", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("  hi  ") });
    const text = await waitAndGet(page, "#x");
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#x",
      expect.objectContaining({ visible: true }),
    );
    expect(text).toBe("hi");
  });

  it("throws SelectorNotFoundError when the selector never appears", async () => {
    const page = mockPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(waitAndGet(page, "#x")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });
});

describe("scroll", () => {
  it("evaluates a scroll function (bottom by default)", async () => {
    const page = mockPage();
    await scroll(page);
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it("passes an explicit pixel amount through to evaluate", async () => {
    const page = mockPage();
    await scroll(page, { by: 500 });
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), 500);
  });
});
```

- [ ] **Step 2: Run, confirm failure** — `pnpm --filter @technical-1/interaction-helpers test` → FAIL (cannot resolve `./helpers.js`).

- [ ] **Step 3: Write `packages/interaction-helpers/src/helpers.ts`**

```ts
import type { Page } from "puppeteer-core";
import { SelectorNotFoundError } from "@technical-1/core";
import type { LoggerOption, TimeoutOption } from "@technical-1/core";

// Minimal browser-global declarations for in-page evaluate callbacks (roadmap
// convention). Module-scoped (this file is a module — no global leak); NOT the
// DOM lib, NOT @types. Declare only what the callbacks below actually use.
declare var document: {
  querySelector(s: string): { textContent: string | null } | null;
  body: { scrollHeight: number };
};
declare var window: {
  scrollBy(x: number, y: number): void;
  scrollTo(x: number, y: number): void;
};

const DEFAULT_TIMEOUT = 15000;

export interface InteractionOptions extends LoggerOption, TimeoutOption {}

async function waitVisible(
  page: Page,
  selector: string,
  timeout: number,
): Promise<void> {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
  } catch (err) {
    throw new SelectorNotFoundError(selector, { cause: err });
  }
}

/** Wait for a visible selector, then click it. */
export async function safeClick(
  page: Page,
  selector: string,
  opts: InteractionOptions = {},
): Promise<void> {
  await waitVisible(page, selector, opts.timeout ?? DEFAULT_TIMEOUT);
  opts.logger?.log(`click ${selector}`, "step");
  await page.click(selector);
}

export interface TypeOptions extends InteractionOptions {
  /** Per-keystroke delay in ms. Default 0. */
  delay?: number;
}

/** Wait for a visible selector, then type text into it. */
export async function safeType(
  page: Page,
  selector: string,
  text: string,
  opts: TypeOptions = {},
): Promise<void> {
  await waitVisible(page, selector, opts.timeout ?? DEFAULT_TIMEOUT);
  opts.logger?.log(`type into ${selector}`, "step");
  await page.type(selector, text, { delay: opts.delay ?? 0 });
}

/** Wait for a visible selector, return its trimmed textContent. */
export async function waitAndGet(
  page: Page,
  selector: string,
  opts: InteractionOptions = {},
): Promise<string> {
  await waitVisible(page, selector, opts.timeout ?? DEFAULT_TIMEOUT);
  const text = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    return el ? el.textContent : "";
  }, selector);
  return (text ?? "").trim();
}

export interface ScrollOptions {
  /** If given, scroll by this many pixels; otherwise jump to the bottom. */
  by?: number;
}

/** Scroll the page. Default: jump to the bottom (triggers lazy content). */
export async function scroll(page: Page, opts: ScrollOptions = {}): Promise<void> {
  await page.evaluate((by?: number) => {
    if (typeof by === "number") window.scrollBy(0, by);
    else window.scrollTo(0, document.body.scrollHeight);
  }, opts.by);
}
```

- [ ] **Step 4: Run, confirm pass + typecheck** — `pnpm --filter @technical-1/interaction-helpers test` PASS (8 tests); `pnpm --filter @technical-1/interaction-helpers typecheck` clean. `document`/`window` in the `page.evaluate` callbacks are typed by the module-scoped `declare var` block at the top of `helpers.ts` (roadmap convention — puppeteer-core's `evaluate` generic does NOT supply them; do NOT add `DOM` to tsconfig, do NOT `as any`).

- [ ] **Step 5: Commit**

```bash
git add packages/interaction-helpers/src/helpers.ts packages/interaction-helpers/src/helpers.test.ts
git commit -m "feat(interaction-helpers): hardened safeClick/safeType/waitAndGet/scroll (typed core errors)"
```

---

### Task 3: `@technical-1/interaction-helpers` surface + build

**Files:** Modify `packages/interaction-helpers/src/index.ts`; Test `…/src/index.test.ts`.

- [ ] **Step 1: Failing test** `packages/interaction-helpers/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as ih from "./index.js";

describe("public surface", () => {
  it("exposes the four helpers only", () => {
    expect(typeof ih.safeClick).toBe("function");
    expect(typeof ih.safeType).toBe("function");
    expect(typeof ih.waitAndGet).toBe("function");
    expect(typeof ih.scroll).toBe("function");
    expect(Object.keys(ih).sort()).toEqual(
      ["safeClick", "safeType", "scroll", "waitAndGet"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — exports undefined.

- [ ] **Step 3: Replace `packages/interaction-helpers/src/index.ts`:**

```ts
export { safeClick, safeType, waitAndGet, scroll } from "./helpers.js";
export type {
  InteractionOptions,
  TypeOptions,
  ScrollOptions,
} from "./helpers.js";
```

- [ ] **Step 4:** `pnpm --filter @technical-1/interaction-helpers test` PASS (9 tests); typecheck + build clean.

- [ ] **Step 5:** `ls packages/interaction-helpers/dist/index.js packages/interaction-helpers/dist/index.cjs packages/interaction-helpers/dist/index.d.ts packages/interaction-helpers/dist/index.d.cts` → all four.

- [ ] **Step 6: Commit**

```bash
git add packages/interaction-helpers/src/index.ts packages/interaction-helpers/src/index.test.ts
git commit -m "feat(interaction-helpers): expose public surface; verify dual build"
```

---

### Task 4: `@technical-1/navigation` scaffold

**Files:** `packages/navigation/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1:** Create the 5 skeleton files. `<pkg>`=`navigation`,
  `<description>`=`goto with retry, waitUntil strategies, and SPA network-idle waiting`.
  `dependencies` block (note: ALSO depends on `@technical-1/retry`):

```json
  "dependencies": {
    "@technical-1/core": "workspace:*",
    "@technical-1/retry": "workspace:*"
  },
  "peerDependencies": { "puppeteer-core": ">=22 <25" },
  "devDependencies": { "puppeteer-core": "^24.4.0" }
```

- [ ] **Step 2:** Create `packages/navigation/README.md`:

```markdown
# @technical-1/navigation

`goto` with built-in retry/backoff (via `@technical-1/retry`) and `waitUntil`
strategies, plus an SPA network-idle helper. Failures surface as a
`@technical-1/core` `NavigationError` carrying the URL and cause. You inject
the `Page`.

```ts
import { goto, waitForNetworkIdle } from "@technical-1/navigation";

await goto(page, "https://example.test", { waitUntil: "domcontentloaded" });
await waitForNetworkIdle(page);
```
```

- [ ] **Step 3:** `pnpm install && pnpm -r list --depth -1` → lists
  `@technical-1/navigation`; `@technical-1/core` AND `@technical-1/retry`
  workspace-linked; puppeteer-core present.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(navigation): scaffold @technical-1/navigation (core + retry deps, puppeteer-core peer)"
```

---

### Task 5: `@technical-1/navigation` implementation (TDD)

**Files:** Create `packages/navigation/src/navigation.ts`; Test `…/src/navigation.test.ts`.

- [ ] **Step 1: Write the failing test** `packages/navigation/src/navigation.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { goto, waitForNetworkIdle } from "./navigation.js";
import type { Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    goto: vi.fn().mockResolvedValue(null),
    waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Page;
}

describe("goto", () => {
  it("calls page.goto with url + waitUntil + timeout", async () => {
    const page = mockPage();
    await goto(page, "https://x.test", { waitUntil: "domcontentloaded", timeout: 9000 });
    expect(page.goto).toHaveBeenCalledWith(
      "https://x.test",
      expect.objectContaining({ waitUntil: "domcontentloaded", timeout: 9000 }),
    );
  });

  it("retries a failing navigation then succeeds (no real wait)", async () => {
    const gotoMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("net::ERR_TIMED_OUT"))
      .mockResolvedValue(null);
    const page = mockPage({ goto: gotoMock });
    await goto(page, "https://x.test", {
      retry: { retries: 2, minDelayMs: 0, jitter: false },
    });
    expect(gotoMock).toHaveBeenCalledTimes(2);
  });

  it("wraps a terminal navigation failure in NavigationError (url + cause)", async () => {
    const cause = new Error("net::ERR_NAME_NOT_RESOLVED");
    const page = mockPage({ goto: vi.fn().mockRejectedValue(cause) });
    await expect(
      goto(page, "https://bad.test", {
        retry: { retries: 1, minDelayMs: 0, jitter: false },
      }),
    ).rejects.toMatchObject({ name: "NavigationError", url: "https://bad.test" });
  });
});

describe("waitForNetworkIdle", () => {
  it("delegates to page.waitForNetworkIdle with options", async () => {
    const page = mockPage();
    await waitForNetworkIdle(page, { idleTime: 600, timeout: 12000 });
    expect(page.waitForNetworkIdle).toHaveBeenCalledWith(
      expect.objectContaining({ idleTime: 600, timeout: 12000 }),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — cannot resolve `./navigation.js`.

- [ ] **Step 3: Write `packages/navigation/src/navigation.ts`**

```ts
import type { Page } from "puppeteer-core";
import { withRetry, type RetryOptions } from "@technical-1/retry";
import { NavigationError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";

export type WaitUntil =
  | "load"
  | "domcontentloaded"
  | "networkidle0"
  | "networkidle2";

export interface GotoOptions extends LoggerOption {
  /** Puppeteer waitUntil strategy. Default "load". */
  waitUntil?: WaitUntil;
  /** Per-attempt navigation timeout (ms). Default 30000. */
  timeout?: number;
  /** Retry/backoff policy for the navigation (see @technical-1/retry). */
  retry?: RetryOptions;
}

/**
 * Navigate `page` to `url` with retry/backoff. A failure that survives all
 * retries is rethrown as a `core` `NavigationError` carrying the url + cause
 * (retryable by default — a caller may wrap `goto` in an outer policy).
 */
export async function goto(
  page: Page,
  url: string,
  opts: GotoOptions = {},
): Promise<void> {
  const waitUntil = opts.waitUntil ?? "load";
  const timeout = opts.timeout ?? 30000;
  opts.logger?.log(`navigating to ${url}`, "step");
  try {
    await withRetry(
      async () => {
        await page.goto(url, { waitUntil, timeout });
      },
      { logger: opts.logger, ...opts.retry },
    );
  } catch (err) {
    throw new NavigationError(url, { cause: err, context: { url, waitUntil } });
  }
  opts.logger?.log(`loaded ${url}`, "success");
}

export interface NetworkIdleOptions {
  /** Quiet window before considering the network idle (ms). Default 500. */
  idleTime?: number;
  /** Overall timeout (ms). Default 30000. */
  timeout?: number;
}

/** Wait for the SPA's network to go idle (delegates to puppeteer-core). */
export async function waitForNetworkIdle(
  page: Page,
  opts: NetworkIdleOptions = {},
): Promise<void> {
  await page.waitForNetworkIdle({
    idleTime: opts.idleTime ?? 500,
    timeout: opts.timeout ?? 30000,
  });
}
```

- [ ] **Step 4: Run, confirm pass + typecheck** — `pnpm --filter @technical-1/navigation test` PASS (5 tests, no noise — `retry` uses `minDelayMs:0` so no fake timers needed); `pnpm --filter @technical-1/navigation typecheck` clean. `RetryOptions` imported as `import { withRetry, type RetryOptions }` (verbatimModuleSyntax-correct). If `page.goto`'s `waitUntil` union or `page.waitForNetworkIdle`'s options mismatch puppeteer-core's types, narrow with the exact puppeteer-core type WITHOUT `as any`; report the change.

- [ ] **Step 5: Commit**

```bash
git add packages/navigation/src/navigation.ts packages/navigation/src/navigation.test.ts
git commit -m "feat(navigation): goto wrapped in retry + waitForNetworkIdle (NavigationError on failure)"
```

---

### Task 6: `@technical-1/navigation` surface + build

**Files:** Modify `packages/navigation/src/index.ts`; Test `…/src/index.test.ts`.

- [ ] **Step 1: Failing test** `packages/navigation/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as nav from "./index.js";

describe("public surface", () => {
  it("exposes goto and waitForNetworkIdle only", () => {
    expect(typeof nav.goto).toBe("function");
    expect(typeof nav.waitForNetworkIdle).toBe("function");
    expect(Object.keys(nav).sort()).toEqual(
      ["goto", "waitForNetworkIdle"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — exports undefined.

- [ ] **Step 3: Replace `packages/navigation/src/index.ts`:**

```ts
export { goto, waitForNetworkIdle } from "./navigation.js";
export type {
  GotoOptions,
  WaitUntil,
  NetworkIdleOptions,
} from "./navigation.js";
```

- [ ] **Step 4:** `pnpm --filter @technical-1/navigation test` PASS (6 tests); typecheck + build clean.

- [ ] **Step 5:** `ls packages/navigation/dist/index.js packages/navigation/dist/index.cjs packages/navigation/dist/index.d.ts packages/navigation/dist/index.d.cts` → all four.

- [ ] **Step 6: Commit**

```bash
git add packages/navigation/src/index.ts packages/navigation/src/index.test.ts
git commit -m "feat(navigation): expose public surface; verify dual build"
```

---

### Task 7: `@technical-1/extract` scaffold

**Files:** `packages/extract/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1:** Create the 5 skeleton files. `<pkg>`=`extract`,
  `<description>`=`List, table, and schema-driven DOM extraction helpers`.
  `dependencies` block:

```json
  "dependencies": { "@technical-1/core": "workspace:*" },
  "peerDependencies": { "puppeteer-core": ">=22 <25" },
  "devDependencies": { "puppeteer-core": "^24.4.0" }
```

- [ ] **Step 2:** Create `packages/extract/README.md`:

```markdown
# @technical-1/extract

Structured DOM extraction. Tolerant by design: list/table helpers return empty
collections (not throws) when nothing matches; schema extraction yields `""`
for absent fields. Uses `page.evaluate` under the hood. You inject the `Page`.

```ts
import { extractAll, extractTable, extractSchema } from "@technical-1/extract";

const titles = await extractAll(page, "h2.title");
const rows = await extractTable(page, "table#data");
const row = await extractSchema(page, { name: ".name", price: ".price" });
```
```

- [ ] **Step 3:** `pnpm install && pnpm -r list --depth -1` → lists
  `@technical-1/extract`; core workspace-linked; puppeteer-core present.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(extract): scaffold @technical-1/extract"
```

---

### Task 8: `@technical-1/extract` implementation (TDD)

**Files:** Create `packages/extract/src/extract.ts`; Test `…/src/extract.test.ts`.

The package uses `page.evaluate` (single uniformly-mockable primitive) rather
than Puppeteer's `$`-prefixed eval helpers.

- [ ] **Step 1: Write the failing test** `packages/extract/src/extract.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  extractText,
  extractAll,
  extractTable,
  extractSchema,
} from "./extract.js";
import type { Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    evaluate: vi.fn(),
    ...overrides,
  } as unknown as Page;
}

describe("extractText", () => {
  it("returns trimmed text for a present selector", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("  hi  ") });
    expect(await extractText(page, "h1")).toBe("hi");
  });

  it("returns empty string when the selector is absent", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("") });
    expect(await extractText(page, "h1")).toBe("");
  });
});

describe("extractAll", () => {
  it("returns trimmed text of every match", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue([" a ", "b "]) });
    expect(await extractAll(page, ".x")).toEqual(["a", "b"]);
  });

  it("returns [] when nothing matches", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue([]) });
    expect(await extractAll(page, ".x")).toEqual([]);
  });
});

describe("extractTable", () => {
  it("returns a 2D array of trimmed cell text", async () => {
    const page = mockPage({
      evaluate: vi.fn().mockResolvedValue([
        ["1", "2"],
        ["3", "4"],
      ]),
    });
    expect(await extractTable(page, "table")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("extractSchema", () => {
  it("maps each field selector to its trimmed text ('' when absent)", async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce(" Widget ")
      .mockResolvedValueOnce("");
    const page = mockPage({ evaluate });
    const row = await extractSchema(page, { name: ".name", price: ".price" });
    expect(row).toEqual({ name: "Widget", price: "" });
  });
});
```

- [ ] **Step 2: Run, confirm failure** — cannot resolve `./extract.js`.

- [ ] **Step 3: Write `packages/extract/src/extract.ts`**

```ts
import type { Page } from "puppeteer-core";

// Minimal browser-global declarations for in-page evaluate callbacks (roadmap
// convention). Module-scoped; NOT the DOM lib, NOT @types. Declare only what
// the callbacks below use.
interface InPageElement {
  textContent: string | null;
  querySelectorAll(s: string): Iterable<InPageElement>;
}
declare var document: {
  querySelector(s: string): InPageElement | null;
  querySelectorAll(s: string): Iterable<InPageElement>;
};

/** Trimmed textContent of the first match, or "" if absent. */
export async function extractText(page: Page, selector: string): Promise<string> {
  const text = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    return el && el.textContent ? el.textContent : "";
  }, selector);
  return text.trim();
}

/** Trimmed textContent of every match (empty array if none). */
export async function extractAll(page: Page, selector: string): Promise<string[]> {
  const texts = await page.evaluate((sel: string) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    return nodes.map((el) => (el.textContent ? el.textContent : ""));
  }, selector);
  return texts.map((t) => t.trim());
}

/** Rows × cells of trimmed text from the first matching table. */
export async function extractTable(
  page: Page,
  selector: string,
): Promise<string[][]> {
  return page.evaluate((sel: string) => {
    const table = document.querySelector(sel);
    if (!table) return [] as string[][];
    const rows = Array.from(table.querySelectorAll("tr"));
    return rows.map((row) =>
      Array.from(row.querySelectorAll("td, th")).map((cell) =>
        (cell.textContent ? cell.textContent : "").trim(),
      ),
    );
  }, selector);
}

export type ExtractSchema = Record<string, string>;

/** Map each field's selector to its trimmed text ("" when the node is absent). */
export async function extractSchema(
  page: Page,
  schema: ExtractSchema,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(schema)) {
    const selector = schema[key];
    if (selector === undefined) continue;
    out[key] = await extractText(page, selector);
  }
  return out;
}
```

- [ ] **Step 4: Run, confirm pass + typecheck** — `pnpm --filter @technical-1/extract test` PASS (7 tests); `pnpm --filter @technical-1/extract typecheck` clean. `document` in the `page.evaluate` callbacks is typed by the module-scoped `declare var`/`InPageElement` block at the top of `extract.ts` (roadmap convention; do NOT add `DOM` to tsconfig, do NOT `as any`). `schema[key]` is guarded by an explicit `undefined` check (no `as` cast) for `noUncheckedIndexedAccess`. If the minimal `InPageElement` shape is insufficient for the actual callback usage, extend it minimally (still no DOM lib) and report what you added.

- [ ] **Step 5: Commit**

```bash
git add packages/extract/src/extract.ts packages/extract/src/extract.test.ts
git commit -m "feat(extract): list/table/schema DOM extraction helpers"
```

---

### Task 9: `@technical-1/extract` surface + build

**Files:** Modify `packages/extract/src/index.ts`; Test `…/src/index.test.ts`.

- [ ] **Step 1: Failing test** `packages/extract/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as ex from "./index.js";

describe("public surface", () => {
  it("exposes the four extraction fns only", () => {
    expect(typeof ex.extractText).toBe("function");
    expect(typeof ex.extractAll).toBe("function");
    expect(typeof ex.extractTable).toBe("function");
    expect(typeof ex.extractSchema).toBe("function");
    expect(Object.keys(ex).sort()).toEqual(
      ["extractAll", "extractSchema", "extractTable", "extractText"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — exports undefined.

- [ ] **Step 3: Replace `packages/extract/src/index.ts`:**

```ts
export {
  extractText,
  extractAll,
  extractTable,
  extractSchema,
} from "./extract.js";
export type { ExtractSchema } from "./extract.js";
```

- [ ] **Step 4:** `pnpm --filter @technical-1/extract test` PASS (8 tests); typecheck + build clean.

- [ ] **Step 5:** `ls packages/extract/dist/index.js packages/extract/dist/index.cjs packages/extract/dist/index.d.ts packages/extract/dist/index.d.cts` → all four.

- [ ] **Step 6: Commit**

```bash
git add packages/extract/src/index.ts packages/extract/src/index.test.ts
git commit -m "feat(extract): expose public surface; verify dual build"
```

---

### Task 10: Changesets + whole-monorepo CI gate

**Files:** Create `.changeset/navigation-data.md`.

- [ ] **Step 1: Create `.changeset/navigation-data.md`:**

```markdown
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
```

- [ ] **Step 2: Whole-monorepo CI gate** — `pnpm install && pnpm run ci` → ALL
  9 packages green. Capture turbo summary + per-package counts (core 13,
  retry 10, logger 7, config 9, chrome-setup 12, launcher 14,
  interaction-helpers 9, navigation 6, extract 8 = 88). `pnpm run lint` → ZERO
  warnings/errors. If anything fails, STOP and report (don't mask).

- [ ] **Step 3: Invariant sweep** — `grep -rn "autom8ops" packages/ docs/ .changeset/ .github/ 2>/dev/null | grep -v node_modules || echo "clean"` → `clean`.

- [ ] **Step 4: Commit**

```bash
git add .changeset/navigation-data.md
git commit -m "chore: changeset for the navigation & data tier"
```

---

## Self-Review

**Spec coverage (this slice):**
- §5 catalog: `navigation` (goto+retry, waitUntil, SPA idle; deps core+retry,
  peer puppeteer-core) ✓ T4–6; `interaction-helpers` (safeClick/safeType/
  waitAndGet/scroll from Kanfer, hardened; deps core, peer puppeteer-core) ✓
  T1–3; `extract` (table/list/schema; deps core, peer puppeteer-core) ✓ T7–9.
- §4.1 puppeteer-core peer (bounded `>=22 <25`), not bundled ✓.
- §4.2 acyclic: each → core; navigation also → retry (capability→utility,
  allowed); NO capability↔capability dep ✓.
- §4.3 DI logging via `LoggerOption` ✓. §4.4 function-first (all functions; no
  classes — no intrinsic state) ✓.
- §4.5 layout (canonical exports/tsup/vitest/README/sideEffects:false) ✓.
- §4.6/§8 typed errors: `interaction-helpers` throws `SelectorNotFoundError`
  (carries selector); `navigation` wraps failures in `NavigationError`
  (url+cause); `extract` intentionally tolerant (documented) ✓.
- §9 every export unit-tested; mock `Page` only — no real Chrome, no network;
  `navigation` retry uses `minDelayMs:0` (no real timers) ✓. §12 no creds ✓.
- Roadmap conventions: canonical exports map, per-pkg vitest, root @types/node
  (no DOM/lib), no dead eslint-disable, DI-mockable browser pattern,
  bound peer ranges, wrap-external-errors-typed ✓.

**Placeholder scan:** each package ships `export {}` in its scaffold task,
replaced in its surface task (3/6/9). Skeleton written once, referenced with
full content. No TBD / "similar to Task N".

**Type consistency:** `InteractionOptions`/`TypeOptions`/`ScrollOptions`/
`GotoOptions`/`WaitUntil`/`NetworkIdleOptions`/`ExtractSchema` defined in impl
tasks, re-exported with identical names, asserted by exact-`Object.keys`
barrel tests (T3/6/9). `safeClick`/`safeType`/`waitAndGet`/`scroll`/`goto`/
`waitForNetworkIdle`/`extractText`/`extractAll`/`extractTable`/`extractSchema`
names consistent across impl, index, README, tests. `withRetry`/`RetryOptions`
consumed from `@technical-1/retry`; `NavigationError`/`SelectorNotFoundError`/
`LoggerOption`/`TimeoutOption` from `@technical-1/core` — names match Plans
01–02.
