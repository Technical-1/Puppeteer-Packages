# Anti-Detection (`stealth`, `fingerprint`, `human`, `proxy`) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the four anti-detection capability packages —
`@technical-1/stealth` (puppeteer-extra-plugin-stealth wrapper),
`@technical-1/fingerprint` (UA/viewport/locale/timezone randomization),
`@technical-1/human` (humanized delays / typing / mouse), and
`@technical-1/proxy` (proxy arg, auth, rotation) — fully built, tested,
changeset-versioned.

**Architecture:** Four workspace packages. Dependency shapes differ — they
deliberately exercise the cemented "declare core only when imported" + bounded
puppeteer-core peer + DI-mockable conventions:

| Package | core dep | puppeteer-core peer | other real deps |
|---|---|---|---|
| `stealth` | none (standalone) | none | `puppeteer-extra`, `puppeteer-extra-plugin-stealth` (§4.1 exception — the stealth mechanism) |
| `fingerprint` | none (standalone) | `>=22 <25` peer | — |
| `human` | none (standalone) | `>=22 <25` peer | — |
| `proxy` | `dependencies` (imports `ProxyError` value) | `>=22 <25` peer | — |

`stealth` is a second documented §4.1 real-dependency exception (like
`chrome-setup`'s `@puppeteer/browsers`): `puppeteer-extra` +
`puppeteer-extra-plugin-stealth` ARE the stealth implementation, so they are
real `dependencies`, not peers. All page-driving packages import ONLY
`puppeteer-core` types and inject the `Page`/instance (unit-test with mocks —
no real Chrome/network, spec §9). `proxy` throws the typed `core` `ProxyError`
(retryable) for invalid input (§4.6/§8).

**Tech Stack:** TypeScript (NodeNext, strict, verbatimModuleSyntax), tsup,
vitest. `puppeteer-core` types only (peer) for fingerprint/human/proxy.
`puppeteer-extra` + `puppeteer-extra-plugin-stealth` (real deps) for stealth.

**Working dir:** `/Users/jacobkanfer/Desktop/Code/Puppeteer-Packages`
(execution on `feat/05-anti-detection`, branched from `main` at the Plan 04
tip). Authorship `Jacob Kanfer <kanfer@users.noreply.github.com>` (configured;
never `--author`).

**Invariants (roadmap — verify every task):** prohibited brand string (spec
§3) never appears; canonical per-condition `exports` map; per-package minimal
`vitest.config.ts`; root `@types/node` (no per-pkg `lib`/`DOM`); no dead
`eslint-disable`; typed `core` errors where thrown (`proxy` → `ProxyError`);
function-first APIs (class only for intrinsic state — `ProxyRotator`);
DI-mockable (type-only peer import, inject Page/instance; `src/` zero
`any`/`as`, test mocks may `as unknown as Page` at the boundary only);
declare core only when a core symbol is actually imported (value→deps,
type→devDeps, none→no core dep); bound peer ranges `>=22 <25`; fake-timer
tests attach-rejection-before-draining; **mocks only — no real Chrome /
no network** (spec §9, §12).

---

## Canonical package skeleton (scaffold tasks use verbatim)

Identical to Plan 04. `packages/<pkg>/package.json`:

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
`src/index.ts` byte-identical to Plan 04 skeleton:

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

Standard bounded peer+dev block (fingerprint/human/proxy):

```json
  "peerDependencies": { "puppeteer-core": ">=22 <25" },
  "devDependencies": { "puppeteer-core": "^24.4.0" }
```

---

### Task 1: `@technical-1/stealth` scaffold

**Files:** `packages/stealth/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1:** Create the 5 skeleton files. `<pkg>`=`stealth`,
  `<description>`=`puppeteer-extra-plugin-stealth wrapper for the @technical-1 suite`.
  Dependency block (real deps — the §4.1 stealth-mechanism exception; NO core,
  NO puppeteer-core peer):

```json
  "dependencies": {
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2"
  }
```

- [ ] **Step 2:** Create `packages/stealth/README.md`:

```markdown
# @technical-1/stealth

Applies `puppeteer-extra-plugin-stealth` to your puppeteer instance — the
standard fingerprint-hardening evasions. You pass your `puppeteer` in; this
package owns `puppeteer-extra` + the stealth plugin as real dependencies (they
ARE the stealth mechanism).

```ts
import puppeteer from "puppeteer-core";
import { applyStealth } from "@technical-1/stealth";

const stealthPuppeteer = applyStealth(puppeteer);
const browser = await stealthPuppeteer.launch({ executablePath });
```
```

- [ ] **Step 3:** `pnpm install && pnpm -r list --depth -1` → succeeds; lists
  `@technical-1/stealth`; `puppeteer-extra` + `puppeteer-extra-plugin-stealth`
  resolved (real deps — large transitive lock diff is EXPECTED). No core, no
  puppeteer-core.

- [ ] **Step 4:** Commit:

```bash
git add -A
git commit -m "chore(stealth): scaffold @technical-1/stealth"
```

---

### Task 2: `@technical-1/stealth` implementation (TDD)

**Files:** Create `packages/stealth/src/stealth.ts`; Test `packages/stealth/src/stealth.test.ts`.

- [ ] **Step 1: Write the failing test** `packages/stealth/src/stealth.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

// Spies referenced in a vi.mock factory MUST be vi.hoisted() (vi.mock is
// hoisted above const → TDZ otherwise). Roadmap convention.
const { useSpy, extraInstance, addExtraSpy, stealthPluginSpy } = vi.hoisted(
  () => {
    const useSpy = vi.fn();
    const extraInstance = { use: useSpy };
    const addExtraSpy = vi.fn(() => extraInstance);
    const stealthPluginSpy = vi.fn(() => ({ name: "stealth" }));
    return { useSpy, extraInstance, addExtraSpy, stealthPluginSpy };
  },
);

vi.mock("puppeteer-extra", () => ({ addExtra: addExtraSpy }));
vi.mock("puppeteer-extra-plugin-stealth", () => ({ default: stealthPluginSpy }));

import { applyStealth } from "./stealth.js";

describe("applyStealth", () => {
  it("wraps the puppeteer instance with addExtra and applies the stealth plugin", () => {
    const puppeteer = { launch: vi.fn() };
    // test-boundary cast: minimal mock doesn't satisfy full VanillaPuppeteer
    const result = applyStealth(puppeteer as never);
    expect(addExtraSpy).toHaveBeenCalledWith(puppeteer);
    expect(stealthPluginSpy).toHaveBeenCalledTimes(1);
    expect(useSpy).toHaveBeenCalledWith({ name: "stealth" });
    expect(result).toBe(extraInstance);
  });
});
```

- [ ] **Step 2: Run, confirm failure** — `pnpm --filter @technical-1/stealth test` → FAIL (cannot resolve `./stealth.js`).

- [ ] **Step 3: Write `packages/stealth/src/stealth.ts`**

```ts
import { addExtra } from "puppeteer-extra";
import type { VanillaPuppeteer } from "puppeteer-extra";
// puppeteer-extra-plugin-stealth ships CJS `export =`. The DEFAULT import is
// correct here: it typechecks (esModuleInterop:true + the package's .d.ts →
// no TS1259) AND is the only form vi.mock can intercept. `import = require`
// would compile to a sync require() that Vitest's mock registry can't see
// (roadmap "CJS export= deps" convention). `addExtra` is a named export.
import StealthPlugin from "puppeteer-extra-plugin-stealth";

/**
 * Wrap a puppeteer instance with `puppeteer-extra` and apply the stealth
 * plugin. Returns the stealth-enhanced launcher (use its `.launch`).
 *
 * @remarks Pass a raw puppeteer instance — do NOT pass the return value of a
 * previous `applyStealth` call (that double-wraps and fires stealth hooks
 * twice).
 */
export function applyStealth(
  puppeteer: VanillaPuppeteer,
): ReturnType<typeof addExtra> {
  const enhanced = addExtra(puppeteer);
  enhanced.use(StealthPlugin());
  return enhanced;
}
```

The test's minimal mock (`{ launch: vi.fn() }`) does not satisfy the full
`VanillaPuppeteer` interface, so the Step-1 test calls
`applyStealth(puppeteer as never)` — a test-boundary cast (the established
convention, like `as unknown as Page`); `src/` carries ZERO casts. The
Step-1 `useSpy` is a plain `vi.fn()` (no `mockReturnThis()` — `applyStealth`
never uses `.use()`'s return).

- [ ] **Step 4: Run, confirm pass + typecheck** — `pnpm --filter @technical-1/stealth test` PASS (1 test); `pnpm --filter @technical-1/stealth typecheck` clean. `addExtra`/`StealthPlugin` ship their own types (real deps). The single `puppeteer as never` is the minimal DI boundary cast (puppeteer-extra types are loose) — no `as any`.
  **CJS interop (empirically verified — roadmap convention):** use the DEFAULT
  import `import StealthPlugin from "puppeteer-extra-plugin-stealth"`. It
  typechecks here (`esModuleInterop:true` + the package's `.d.ts` → no TS1259)
  and is the only form `vi.mock` can intercept. `import = require` is WRONG —
  it compiles to a sync `require()` Vitest's mock registry can't see (spy = 0
  calls). The matching mock is `vi.mock("puppeteer-extra-plugin-stealth", () =>
  ({ default: stealthPluginSpy }))`, with the spies created via `vi.hoisted()`
  (vi.mock hoists above `const` → TDZ). Task 3's index.test.ts uses an inline
  `vi.fn()` in the factory (`{ default: vi.fn() }`) — no hoist needed there.

- [ ] **Step 5: Commit**

```bash
git add packages/stealth/src/stealth.ts packages/stealth/src/stealth.test.ts
git commit -m "feat(stealth): applyStealth wrapping puppeteer-extra + stealth plugin"
```

---

### Task 3: `@technical-1/stealth` surface + build

**Files:** Modify `packages/stealth/src/index.ts`; Test `…/src/index.test.ts`.

- [ ] **Step 1: Failing test** `packages/stealth/src/index.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("puppeteer-extra", () => ({ addExtra: vi.fn(() => ({ use: vi.fn() })) }));
vi.mock("puppeteer-extra-plugin-stealth", () => ({ default: vi.fn() }));

import * as stealth from "./index.js";

describe("public surface", () => {
  it("exposes applyStealth only", () => {
    expect(typeof stealth.applyStealth).toBe("function");
    expect(Object.keys(stealth).sort()).toEqual(["applyStealth"].sort());
  });
});
```

- [ ] **Step 2: Run, confirm failure** — exports undefined.

- [ ] **Step 3: Replace `packages/stealth/src/index.ts`:**

```ts
export { applyStealth } from "./stealth.js";
```

- [ ] **Step 4:** `pnpm --filter @technical-1/stealth test` PASS (2 tests); typecheck + build clean.

- [ ] **Step 5:** `ls packages/stealth/dist/index.js packages/stealth/dist/index.cjs packages/stealth/dist/index.d.ts packages/stealth/dist/index.d.cts` → all four.

- [ ] **Step 6: Commit**

```bash
git add packages/stealth/src/index.ts packages/stealth/src/index.test.ts
git commit -m "feat(stealth): expose public surface; verify dual build"
```

---

### Task 4: `@technical-1/fingerprint` scaffold

**Files:** `packages/fingerprint/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1:** Create the 5 skeleton files. `<pkg>`=`fingerprint`,
  `<description>`=`UA / viewport / locale / timezone randomization`.
  Dependency block (standalone — no core; bounded peer only):

```json
  "peerDependencies": { "puppeteer-core": ">=22 <25" },
  "devDependencies": { "puppeteer-core": "^24.4.0" }
```

- [ ] **Step 2:** Create `packages/fingerprint/README.md`:

```markdown
# @technical-1/fingerprint

Randomize (or pin) a browser fingerprint — user agent, viewport, locale,
timezone — and apply it to a `Page`. You inject the `Page` (type-only
`puppeteer-core` peer). No `@technical-1/core` dependency.

```ts
import { randomFingerprint, applyFingerprint } from "@technical-1/fingerprint";

const fp = randomFingerprint();
await applyFingerprint(page, fp);
```
```

- [ ] **Step 3:** `pnpm install && pnpm -r list --depth -1` → lists
  `@technical-1/fingerprint`; puppeteer-core present (dev+peer); no core.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(fingerprint): scaffold @technical-1/fingerprint"
```

---

### Task 5: `@technical-1/fingerprint` implementation (TDD)

**Files:** Create `packages/fingerprint/src/fingerprint.ts`; Test `…/src/fingerprint.test.ts`.

- [ ] **Step 1: Write the failing test** `packages/fingerprint/src/fingerprint.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  randomFingerprint,
  applyFingerprint,
  type Fingerprint,
} from "./fingerprint.js";
import type { Page } from "puppeteer-core";

function mockPage(): Page {
  return {
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    emulateTimezone: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe("randomFingerprint", () => {
  it("returns a well-formed fingerprint from the curated pools", () => {
    const fp = randomFingerprint();
    expect(typeof fp.userAgent).toBe("string");
    expect(fp.userAgent.length).toBeGreaterThan(0);
    expect(fp.viewport.width).toBeGreaterThan(0);
    expect(fp.viewport.height).toBeGreaterThan(0);
    expect(typeof fp.locale).toBe("string");
    expect(typeof fp.timezoneId).toBe("string");
  });

  it("is deterministic when given a seeded picker", () => {
    const fp = randomFingerprint(() => 0);
    const fp2 = randomFingerprint(() => 0);
    expect(fp).toEqual(fp2);
  });
});

describe("applyFingerprint", () => {
  it("applies UA, viewport, timezone and Accept-Language to the page", async () => {
    const page = mockPage();
    const fp: Fingerprint = {
      userAgent: "UA/1.0",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
    };
    await applyFingerprint(page, fp);
    expect(page.setUserAgent).toHaveBeenCalledWith({ userAgent: "UA/1.0" });
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1280, height: 800 });
    expect(page.emulateTimezone).toHaveBeenCalledWith("America/New_York");
    expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
      "Accept-Language": "en-US",
    });
  });
});
```

- [ ] **Step 2: Run, confirm failure** — cannot resolve `./fingerprint.js`.

- [ ] **Step 3: Write `packages/fingerprint/src/fingerprint.ts`**

```ts
import type { Page } from "puppeteer-core";

export interface Fingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1280, height: 800 },
];
const LOCALES = ["en-US", "en-GB", "de-DE", "fr-FR"];
const TIMEZONES = [
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
];

/** Random number source in [0, 1). Override for deterministic tests. */
export type RandomFn = () => number;

function pick<T>(pool: readonly T[], rand: RandomFn): T {
  const idx = Math.floor(rand() * pool.length);
  return pool[Math.min(idx, pool.length - 1)] as T;
}

/** Build a random fingerprint from curated pools (inject `rand` for tests). */
export function randomFingerprint(rand: RandomFn = Math.random): Fingerprint {
  return {
    userAgent: pick(USER_AGENTS, rand),
    viewport: pick(VIEWPORTS, rand),
    locale: pick(LOCALES, rand),
    timezoneId: pick(TIMEZONES, rand),
  };
}

/** Apply a fingerprint to a page (UA, viewport, timezone, Accept-Language). */
export async function applyFingerprint(
  page: Page,
  fp: Fingerprint,
): Promise<void> {
  // object form — the string overload is @deprecated in puppeteer-core 24.x
  await page.setUserAgent({ userAgent: fp.userAgent });
  await page.setViewport(fp.viewport);
  await page.emulateTimezone(fp.timezoneId);
  await page.setExtraHTTPHeaders({ "Accept-Language": fp.locale });
}
```

- [ ] **Step 4: Run, confirm pass + typecheck** — `pnpm --filter @technical-1/fingerprint test` PASS (3 tests; code review adds an empty-pool guard, bumps the UA pool to Chrome 144, adds a q-value `ACCEPT_LANGUAGE` map, and adds a clamp-at-1.0 test + index-0/`toHaveBeenCalledTimes` assertions → 4 tests, commit `09804dd`); `pnpm --filter @technical-1/fingerprint typecheck` clean. `pick`'s `as T` is a `noUncheckedIndexedAccess` boundary (provably in-range post empty-guard + `Math.min` clamp; no `any`). `{width,height}` is structurally assignable to `Viewport` (other fields optional) — no DOM lib / `as any`.

- [ ] **Step 5: Commit**

```bash
git add packages/fingerprint/src/fingerprint.ts packages/fingerprint/src/fingerprint.test.ts
git commit -m "feat(fingerprint): randomFingerprint + applyFingerprint (UA/viewport/locale/tz)"
```

---

### Task 6: `@technical-1/fingerprint` surface + build

**Files:** Modify `packages/fingerprint/src/index.ts`; Test `…/src/index.test.ts`.

- [ ] **Step 1: Failing test** `packages/fingerprint/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as fp from "./index.js";

describe("public surface", () => {
  it("exposes randomFingerprint and applyFingerprint only", () => {
    expect(typeof fp.randomFingerprint).toBe("function");
    expect(typeof fp.applyFingerprint).toBe("function");
    expect(Object.keys(fp).sort()).toEqual(
      ["applyFingerprint", "randomFingerprint"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — exports undefined.

- [ ] **Step 3: Replace `packages/fingerprint/src/index.ts`:**

```ts
export { randomFingerprint, applyFingerprint } from "./fingerprint.js";
export type { Fingerprint, RandomFn } from "./fingerprint.js";
```

- [ ] **Step 4:** `pnpm --filter @technical-1/fingerprint test` PASS (5 tests: 4 fingerprint + 1 index); typecheck + build clean.

- [ ] **Step 5:** `ls packages/fingerprint/dist/index.js packages/fingerprint/dist/index.cjs packages/fingerprint/dist/index.d.ts packages/fingerprint/dist/index.d.cts` → all four.

- [ ] **Step 6: Commit**

```bash
git add packages/fingerprint/src/index.ts packages/fingerprint/src/index.test.ts
git commit -m "feat(fingerprint): expose public surface; verify dual build"
```

---

### Task 7: `@technical-1/human` scaffold

**Files:** `packages/human/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1:** Create the 5 skeleton files. `<pkg>`=`human`,
  `<description>`=`Humanized delays, typing cadence, and mouse movement`.
  Dependency block (standalone — no core; bounded peer only):

```json
  "peerDependencies": { "puppeteer-core": ">=22 <25" },
  "devDependencies": { "puppeteer-core": "^24.4.0" }
```

- [ ] **Step 2:** Create `packages/human/README.md`:

```markdown
# @technical-1/human

Humanize automation timing: randomized delays, per-keystroke typing cadence,
and stepwise mouse movement. You inject the `Page` (type-only `puppeteer-core`
peer). No `@technical-1/core` dependency.

```ts
import { humanDelay, humanType, humanMouseMove } from "@technical-1/human";

await humanDelay({ minMs: 200, maxMs: 800 });
await humanType(page, "#q", "hello");
await humanMouseMove(page, { x: 0, y: 0 }, { x: 400, y: 300 });
```
```

- [ ] **Step 3:** `pnpm install && pnpm -r list --depth -1` → lists
  `@technical-1/human`; puppeteer-core present; no core.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(human): scaffold @technical-1/human"
```

---

### Task 8: `@technical-1/human` implementation (TDD)

**Files:** Create `packages/human/src/human.ts`; Test `…/src/human.test.ts`.

- [ ] **Step 1: Write the failing test** `packages/human/src/human.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { humanDelay, humanType, humanMouseMove } from "./human.js";
import type { Page } from "puppeteer-core";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("humanDelay", () => {
  it("waits a delay within [minMs, maxMs] (deterministic via rand)", async () => {
    const p = humanDelay({ minMs: 100, maxMs: 200, rand: () => 0.5 });
    await vi.advanceTimersByTimeAsync(149);
    let done = false;
    void p.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false); // 150ms expected, not elapsed at 149
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });
});

describe("humanType", () => {
  it("types each character with a randomized per-key delay", async () => {
    const key = vi.fn().mockResolvedValue(undefined);
    const page = { keyboard: { type: vi.fn(), press: key } } as unknown as Page;
    const typeFn = vi.fn().mockResolvedValue(undefined);
    (page.keyboard as unknown as { type: typeof typeFn }).type = typeFn;
    const p = humanType(page, "#in", "ab", { minKeyMs: 10, maxKeyMs: 20, rand: () => 0 });
    await vi.runAllTimersAsync();
    await p;
    expect(typeFn).toHaveBeenCalledTimes(2);
    expect(typeFn).toHaveBeenNthCalledWith(1, "a");
    expect(typeFn).toHaveBeenNthCalledWith(2, "b");
  });
});

describe("humanMouseMove", () => {
  it("moves the mouse in N steps from start to end", async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const page = { mouse: { move } } as unknown as Page;
    const p = humanMouseMove(
      page,
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { steps: 4 },
    );
    await vi.runAllTimersAsync();
    await p;
    expect(move).toHaveBeenCalledTimes(4);
    expect(move).toHaveBeenLastCalledWith(100, 100);
  });
});
```

- [ ] **Step 2: Run, confirm failure** — cannot resolve `./human.js`.

- [ ] **Step 3: Write `packages/human/src/human.ts`**

```ts
import type { Page } from "puppeteer-core";

export type RandomFn = () => number;

function between(min: number, max: number, rand: RandomFn): number {
  return min + rand() * (max - min);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface DelayOptions {
  minMs?: number;
  maxMs?: number;
  rand?: RandomFn;
}

/** Wait a randomized delay in [minMs, maxMs] (default 50–250). */
export async function humanDelay(opts: DelayOptions = {}): Promise<void> {
  const min = opts.minMs ?? 50;
  const max = opts.maxMs ?? 250;
  await sleep(between(min, max, opts.rand ?? Math.random));
}

export interface TypeOptions {
  minKeyMs?: number;
  maxKeyMs?: number;
  rand?: RandomFn;
}

/** Type text one key at a time with a randomized inter-key delay. */
export async function humanType(
  page: Page,
  selector: string,
  text: string,
  opts: TypeOptions = {},
): Promise<void> {
  const min = opts.minKeyMs ?? 40;
  const max = opts.maxKeyMs ?? 160;
  const rand = opts.rand ?? Math.random;
  await page.focus(selector);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(between(min, max, rand));
  }
}

export interface MousePoint {
  x: number;
  y: number;
}

export interface MouseMoveOptions {
  steps?: number;
}

/** Move the mouse from `from` to `to` in `steps` linear increments. */
export async function humanMouseMove(
  page: Page,
  from: MousePoint,
  to: MousePoint,
  opts: MouseMoveOptions = {},
): Promise<void> {
  const steps = Math.max(1, opts.steps ?? 12);
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await page.mouse.move(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
    );
  }
}
```

- [ ] **Step 4: Run, confirm pass + typecheck** — `pnpm --filter @technical-1/human test` PASS (3 tests, no noise — fake timers; the resolve-path delays drain via `runAllTimersAsync`/`advanceTimersByTimeAsync`, no unhandled rejection since nothing rejects); `pnpm --filter @technical-1/human typecheck` clean. The test mock for `humanType` reassigns `page.keyboard.type`; `page.focus`/`page.keyboard.type`/`page.mouse.move` are the only Page members used — confirm puppeteer-core types them. No `any`/DOM-lib in `src`.

- [ ] **Step 5: Commit**

```bash
git add packages/human/src/human.ts packages/human/src/human.test.ts
git commit -m "feat(human): humanDelay + humanType + humanMouseMove"
```

---

### Task 9: `@technical-1/human` surface + build

**Files:** Modify `packages/human/src/index.ts`; Test `…/src/index.test.ts`.

- [ ] **Step 1: Failing test** `packages/human/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as human from "./index.js";

describe("public surface", () => {
  it("exposes humanDelay, humanType, humanMouseMove only", () => {
    expect(typeof human.humanDelay).toBe("function");
    expect(typeof human.humanType).toBe("function");
    expect(typeof human.humanMouseMove).toBe("function");
    expect(Object.keys(human).sort()).toEqual(
      ["humanDelay", "humanMouseMove", "humanType"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — exports undefined.

- [ ] **Step 3: Replace `packages/human/src/index.ts`:**

```ts
export { humanDelay, humanType, humanMouseMove } from "./human.js";
export type {
  RandomFn,
  DelayOptions,
  TypeOptions,
  MousePoint,
  MouseMoveOptions,
} from "./human.js";
```

- [ ] **Step 4:** `pnpm --filter @technical-1/human test` PASS (4 tests); typecheck + build clean.

- [ ] **Step 5:** `ls packages/human/dist/index.js packages/human/dist/index.cjs packages/human/dist/index.d.ts packages/human/dist/index.d.cts` → all four.

- [ ] **Step 6: Commit**

```bash
git add packages/human/src/index.ts packages/human/src/index.test.ts
git commit -m "feat(human): expose public surface; verify dual build"
```

---

### Task 10: `@technical-1/proxy` scaffold

**Files:** `packages/proxy/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1:** Create the 5 skeleton files. `<pkg>`=`proxy`,
  `<description>`=`Proxy launch args, authenticated proxies, and rotation`.
  Dependency block (core dep — imports `ProxyError` VALUE; bounded peer):

```json
  "dependencies": { "@technical-1/core": "workspace:*" },
  "peerDependencies": { "puppeteer-core": ">=22 <25" },
  "devDependencies": { "puppeteer-core": "^24.4.0" }
```

- [ ] **Step 2:** Create `packages/proxy/README.md`:

```markdown
# @technical-1/proxy

Proxy helpers: build the Chrome `--proxy-server` launch arg, apply
authenticated-proxy credentials to a `Page`, and round-robin a proxy pool.
Invalid input throws a `@technical-1/core` `ProxyError`.

```ts
import { proxyArg, applyProxyAuth, ProxyRotator } from "@technical-1/proxy";

const args = [proxyArg("http://1.2.3.4:8080")];
await applyProxyAuth(page, { username: "u", password: "p" });
const rotator = new ProxyRotator(["http://a:1", "http://b:2"]);
rotator.next();
```
```

- [ ] **Step 3:** `pnpm install && pnpm -r list --depth -1` → lists
  `@technical-1/proxy`; `@technical-1/core` workspace-linked; puppeteer-core present.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(proxy): scaffold @technical-1/proxy"
```

---

### Task 11: `@technical-1/proxy` implementation (TDD)

**Files:** Create `packages/proxy/src/proxy.ts`; Test `…/src/proxy.test.ts`.

- [ ] **Step 1: Write the failing test** `packages/proxy/src/proxy.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { proxyArg, applyProxyAuth, ProxyRotator } from "./proxy.js";
import { ProxyError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

describe("proxyArg", () => {
  it("builds the --proxy-server arg from a url", () => {
    expect(proxyArg("http://1.2.3.4:8080")).toBe(
      "--proxy-server=http://1.2.3.4:8080",
    );
  });

  it("throws ProxyError for an empty/blank url", () => {
    expect(() => proxyArg("")).toThrow(ProxyError);
    expect(() => proxyArg("   ")).toThrow(ProxyError);
  });
});

describe("applyProxyAuth", () => {
  it("calls page.authenticate with the credentials", async () => {
    const page = {
      authenticate: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;
    await applyProxyAuth(page, { username: "u", password: "p" });
    expect(page.authenticate).toHaveBeenCalledWith({
      username: "u",
      password: "p",
    });
  });
});

describe("ProxyRotator", () => {
  it("round-robins through the proxy pool", () => {
    const r = new ProxyRotator(["a", "b", "c"]);
    expect([r.next(), r.next(), r.next(), r.next()]).toEqual([
      "a",
      "b",
      "c",
      "a",
    ]);
  });

  it("throws ProxyError when constructed with an empty pool", () => {
    expect(() => new ProxyRotator([])).toThrow(ProxyError);
  });
});
```

- [ ] **Step 2: Run, confirm failure** — cannot resolve `./proxy.js`.

- [ ] **Step 3: Write `packages/proxy/src/proxy.ts`**

```ts
import { ProxyError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

/** Build the Chrome `--proxy-server=<url>` launch arg. Throws on blank input. */
export function proxyArg(url: string): string {
  if (url.trim() === "") {
    throw new ProxyError("Proxy URL must be a non-empty string", {
      context: { url },
    });
  }
  return `--proxy-server=${url}`;
}

export interface ProxyCredentials {
  username: string;
  password: string;
}

/** Apply authenticated-proxy credentials to a page. */
export async function applyProxyAuth(
  page: Page,
  credentials: ProxyCredentials,
): Promise<void> {
  await page.authenticate(credentials);
}

/** Round-robin rotator over a non-empty proxy pool. */
export class ProxyRotator {
  readonly #pool: readonly string[];
  #idx = 0;

  constructor(pool: readonly string[]) {
    if (pool.length === 0) {
      throw new ProxyError("ProxyRotator requires a non-empty pool", {
        context: { size: 0 },
      });
    }
    this.#pool = [...pool];
  }

  /** Return the next proxy, cycling back to the start. */
  next(): string {
    const proxy = this.#pool[this.#idx] as string;
    this.#idx = (this.#idx + 1) % this.#pool.length;
    return proxy;
  }
}
```

- [ ] **Step 4: Run, confirm pass + typecheck** — `pnpm --filter @technical-1/proxy test` PASS (5 tests); `pnpm --filter @technical-1/proxy typecheck` clean. `ProxyError` is a value import (thrown); `Page` type-only. `this.#pool[this.#idx] as string` is a `noUncheckedIndexedAccess` boundary on a provably in-range index (modulo over non-empty pool) — acceptable in `src` here (no `any`). If `page.authenticate`'s `Credentials` type differs, `{username,password}` is structurally assignable; confirm without `as any`.

- [ ] **Step 5: Commit**

```bash
git add packages/proxy/src/proxy.ts packages/proxy/src/proxy.test.ts
git commit -m "feat(proxy): proxyArg + applyProxyAuth + ProxyRotator (ProxyError on bad input)"
```

---

### Task 12: `@technical-1/proxy` surface + build

**Files:** Modify `packages/proxy/src/index.ts`; Test `…/src/index.test.ts`.

- [ ] **Step 1: Failing test** `packages/proxy/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as proxy from "./index.js";

describe("public surface", () => {
  it("exposes proxyArg, applyProxyAuth, ProxyRotator only", () => {
    expect(typeof proxy.proxyArg).toBe("function");
    expect(typeof proxy.applyProxyAuth).toBe("function");
    expect(typeof proxy.ProxyRotator).toBe("function");
    expect(Object.keys(proxy).sort()).toEqual(
      ["ProxyRotator", "applyProxyAuth", "proxyArg"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — exports undefined.

- [ ] **Step 3: Replace `packages/proxy/src/index.ts`:**

```ts
export { proxyArg, applyProxyAuth, ProxyRotator } from "./proxy.js";
export type { ProxyCredentials } from "./proxy.js";
```

- [ ] **Step 4:** `pnpm --filter @technical-1/proxy test` PASS (6 tests); typecheck + build clean.

- [ ] **Step 5:** `ls packages/proxy/dist/index.js packages/proxy/dist/index.cjs packages/proxy/dist/index.d.ts packages/proxy/dist/index.d.cts` → all four.

- [ ] **Step 6: Commit**

```bash
git add packages/proxy/src/index.ts packages/proxy/src/index.test.ts
git commit -m "feat(proxy): expose public surface; verify dual build"
```

---

### Task 13: Changesets + whole-monorepo CI gate

**Files:** Create `.changeset/anti-detection.md`.

- [ ] **Step 1: Create `.changeset/anti-detection.md`:**

```markdown
---
"@technical-1/stealth": minor
"@technical-1/fingerprint": minor
"@technical-1/human": minor
"@technical-1/proxy": minor
---

Anti-detection tier: `stealth` (puppeteer-extra-plugin-stealth wrapper;
`puppeteer-extra` is a real dependency), `fingerprint`
(`randomFingerprint`/`applyFingerprint`), `human` (`humanDelay`/`humanType`/
`humanMouseMove`), and `proxy` (`proxyArg`/`applyProxyAuth`/`ProxyRotator`,
throwing `core` `ProxyError`). `fingerprint`/`human`/`proxy` declare
`puppeteer-core` as a peer; `stealth` is standalone.
```

- [ ] **Step 2: Whole-monorepo CI gate** — `pnpm install && pnpm run ci` → ALL
  13 packages green. Capture turbo summary + per-package counts: core 13,
  retry 10, logger 7, config 9, chrome-setup 12, launcher 14,
  interaction-helpers 13, navigation 8, extract 9, stealth 2, fingerprint 5,
  human 4, proxy 6 (= 112 — fingerprint grew +1 from review hardening).
  `pnpm run lint` → ZERO warnings/errors. If anything
  fails, STOP and report (don't mask).

- [ ] **Step 3: Invariant sweep** — `grep -rn "autom8ops" packages/ docs/ .changeset/ .github/ 2>/dev/null | grep -v node_modules || echo "clean"` → `clean`.

- [ ] **Step 4: Commit**

```bash
git add .changeset/anti-detection.md
git commit -m "chore: changeset for the anti-detection tier"
```

---

## Self-Review

**Spec coverage (this slice):**
- §5 catalog: `stealth` (puppeteer-extra-plugin-stealth wrapper; deps
  puppeteer-extra + plugin) ✓ T1–3; `fingerprint` (UA/viewport/locale/tz;
  peer puppeteer-core) ✓ T4–6; `human` (delays/mouse/typing; peer) ✓ T7–9;
  `proxy` (config/rotation/auth; core + peer) ✓ T10–12.
- §4.1: puppeteer-core peer bounded `>=22 <25` on fingerprint/human/proxy;
  `stealth` is the second documented real-dependency exception
  (`puppeteer-extra` + `puppeteer-extra-plugin-stealth` are the mechanism) ✓.
- §4.2 acyclic: only `proxy → core`; the others standalone; NO
  capability↔capability ✓.
- §4.4 function-first; `ProxyRotator` is the sole class (intrinsic rotation
  state — like `BrowserPool`) ✓.
- §4.6/§8: `proxy` throws typed `core` `ProxyError` with `context` for blank
  url / empty pool ✓.
- §9: every export unit-tested; mock Page / mocked puppeteer-extra; `human`
  uses fake timers (no real waits); no real Chrome / no network ✓. §12 no
  bundled creds (proxy credentials are caller-supplied) ✓.
- Roadmap conventions: canonical exports map, per-pkg vitest, root @types/node
  (no DOM/lib), no dead eslint-disable, DI-mockable, bounded peer,
  declare-core-only-when-imported (stealth/fingerprint/human: none;
  proxy: value→deps) ✓.

**Placeholder scan:** each package ships `export {}` in its scaffold task,
replaced in its surface task. Skeleton written once, referenced with full
content. No TBD / "similar to Task N".

**Type consistency:** `Fingerprint`/`RandomFn`/`DelayOptions`/`TypeOptions`/
`MousePoint`/`MouseMoveOptions`/`ProxyCredentials` defined in impl tasks,
re-exported with identical names, asserted by exact-`Object.keys` barrel
tests. `applyStealth`/`randomFingerprint`/`applyFingerprint`/`humanDelay`/
`humanType`/`humanMouseMove`/`proxyArg`/`applyProxyAuth`/`ProxyRotator` names
consistent across impl, index, README, tests. `ProxyError` consumed from
`@technical-1/core` (name matches Plan 01).
