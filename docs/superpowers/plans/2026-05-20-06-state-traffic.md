# Plan 06: State & Traffic Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `state & traffic` tier — `@technical-1/session` (cookie + localStorage + sessionStorage snapshots with a label-keyed store) and `@technical-1/network` (request blocking, response capture, network throttling / offline emulation).

**Architecture:** Two leaf packages, both depending only on `@technical-1/core` and the bounded `puppeteer-core` peer. No cross-package interaction. `session` is class-based per spec §4 conv 4 ("classes only where lifecycle/state is intrinsic — `launcher` pool, `session` store"); `network` is function-first. Both inherit the cemented DI-mockable browser pattern (type-only peer import, `Page`/`CDPSession` by injection, plain object mocks in tests).

**Tech Stack:** TypeScript NodeNext / strict / verbatimModuleSyntax / noUncheckedIndexedAccess, tsup dual ESM+CJS+`.d.ts`+`.d.cts`, vitest mocks only (no real Chrome), `puppeteer-core` as bounded peer `>=22 <25`, typed `PptrKitError`/`SessionError` from `@technical-1/core` with explicit `retryable` flag.

---

## Spec coverage

From spec §5:
- `session` → "Persist/restore cookies + localStorage; login reuse" — `core`, peer `puppeteer-core`.
- `network` → "Request interception, resource blocking, HAR capture" — `core`, peer `puppeteer-core`.

From spec §4 conv 4: `session` store is class-based (lifecycle intrinsic). `network` is function-first.

From spec §4.6 / §8: typed errors. `session` throws `SessionError` (already in `core`, `retryable:false`). `network` wraps external puppeteer errors in `new PptrKitError(..., { retryable: <true if transient>, cause, context })` per the cemented "wrap external errors crossing a package boundary" convention.

From spec §9: mocks only. Both packages use the DI-mockable pattern — accept `Page` (and for throttle, a CDP session from `page.target().createCDPSession()`) by injection, never `vi.mock` puppeteer-core, never network.

From spec §3: `autom8ops` string must never appear.

From spec §11: commits authored `Jacob Kanfer <kanfer@users.noreply.github.com>`.

## File structure

**`packages/session/`** (5 source files + tests):
- `src/types.ts` — `SessionSnapshot` interface
- `src/snapshot.ts` — pure `captureSession(page)` / `restoreSession(page, snapshot)` functions
- `src/store.ts` — `Session` class wrapping the pure functions with a label-keyed `Map<string, SessionSnapshot>` store
- `src/index.ts` — barrel
- Tests: `src/snapshot.test.ts`, `src/store.test.ts`, `src/index.test.ts`

**`packages/network/`** (5 source files + tests):
- `src/types.ts` — `ResponseRecord`, `ResponseCollector`, `ThrottleProfile`, `BlockPattern`
- `src/blocking.ts` — `blockResources(page, patterns)` / `unblockResources(page)`
- `src/responses.ts` — `captureResponses(page, opts?)` returning `ResponseCollector`
- `src/throttling.ts` — `setOffline(page, offline)` / `throttle(page, profile)` + `THROTTLE_PROFILES` constant
- `src/index.ts` — barrel
- Tests: `src/blocking.test.ts`, `src/responses.test.ts`, `src/throttling.test.ts`, `src/index.test.ts`

**Why split into multiple sources?** Each src file has one clear responsibility. Tests live next to the file they test. Public surface (and the cemented `Object.keys(barrel).sort()` test) is centralized in `index.ts`.

## v1 limitations (documented in JSDoc; deferred to Plan 09 pre-1.0 review)

- **`session.captureSession`**: captures cookies + localStorage + sessionStorage. Does NOT capture: `IndexedDB`, `WebSQL`, `Cache API`, `Service Worker` registrations, `Authorization` headers (in-memory state of the running JS app). Adequate for "log in once, reuse cookie+token-in-localStorage" — the dominant use case.
- **`session.restoreSession`**: applies cookies via `page.setCookie(...)` and storage via an `evaluateOnNewDocument` so the storage is present BEFORE the next navigation. Caller must navigate to an origin matching the snapshot before storage is observable (browsers scope storage to origin).
- **`network.captureResponses`**: records `{url, status, method, resourceType, timestamp}`. Does NOT capture full headers or response bodies — that's the HAR-capture surface noted in spec §5 and deferred to v2 (full HAR-1.2 emission). Adequate for assertion-style "did we receive a 200 for this URL?" use cases.
- **`network.throttle`**: uses Chrome DevTools Protocol's `Network.emulateNetworkConditions`. Profiles are the canonical DevTools presets. Does NOT throttle WebSocket / WebRTC (CDP limitation).

## Tasks

### Task 1: Session — scaffold

**Files:**
- Create: `packages/session/package.json`
- Create: `packages/session/tsconfig.json`
- Create: `packages/session/tsup.config.ts`
- Create: `packages/session/vitest.config.ts`
- Create: `packages/session/README.md`
- Create: `packages/session/src/types.ts`
- Create: `packages/session/src/index.ts`
- Create: `packages/session/src/index.test.ts`

- [ ] **Step 1: Create `packages/session/package.json`**

```json
{
  "name": "@technical-1/session",
  "version": "0.0.0",
  "description": "Capture and restore browser session state — cookies, localStorage, sessionStorage — with a label-keyed store for multi-account workflows.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@technical-1/core": "workspace:*"
  },
  "peerDependencies": {
    "puppeteer-core": ">=22 <25"
  },
  "devDependencies": {
    "puppeteer-core": "^24.4.0"
  },
  "sideEffects": false,
  "license": "MIT",
  "publishConfig": { "access": "public" }
}
```

> **Note on `devDependencies`:** browser-driving packages declare
> `puppeteer-core` in BOTH `peerDependencies` (the runtime contract) AND
> `devDependencies` (so this package's own `tsup` DTS step can resolve
> `import type { ... } from "puppeteer-core"` during build). Without the
> devDep, the build fails with `TS2307: Cannot find module 'puppeteer-core'`
> on the type-only `Cookie` import. Matches every prior browser-driving
> package (`launcher`, `navigation`, `interaction-helpers`, `extract`,
> `proxy`, `fingerprint`, `human`).

- [ ] **Step 2: Create `packages/session/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/session/tsup.config.ts`**

```ts
export { default } from "../../tsup.config.base.js";
```

- [ ] **Step 4: Create `packages/session/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 5: Create `packages/session/README.md`**

```markdown
# @technical-1/session

Capture and restore browser session state — cookies, localStorage,
sessionStorage — with an in-memory label-keyed store for multi-account
workflows.

```ts
import { captureSession, restoreSession, Session } from "@technical-1/session";

// Pure form:
const snap = await captureSession(page);
await restoreSession(otherPage, snap);

// With store:
const store = new Session();
await store.save(page, "alice");
await store.load(otherPage, "alice");
```

## v1 limitations

- Captures cookies + localStorage + sessionStorage only. Does NOT capture:
  IndexedDB, Cache API, Service Workers, in-memory JS state. Adequate for the
  dominant "reuse a login cookie / token-in-localStorage" use case.
- `restoreSession` applies storage via `evaluateOnNewDocument` — the storage
  is present before the next navigation. Browsers scope storage to origin, so
  the caller must navigate to a matching origin to observe it.

## Errors

Throws `SessionError` from `@technical-1/core` (terminal — `retryable: false`)
on capture/restore failures with the underlying `cause` attached.

## Peer

Requires `puppeteer-core` `>=22 <25`.
```

- [ ] **Step 6: Create `packages/session/src/types.ts`**

```ts
import type { Cookie } from "puppeteer-core";

/**
 * Snapshot of a page's persistent state. Plain data — JSON-serializable.
 *
 * v1 captures cookies + localStorage + sessionStorage. See README for the
 * list of state intentionally NOT captured.
 */
export interface SessionSnapshot {
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  /** ISO-8601 capture timestamp — informational only. */
  capturedAt: string;
}
```

- [ ] **Step 7: Create `packages/session/src/index.ts`**

```ts
// Public surface — filled in by Tasks 2 & 3.
export type { SessionSnapshot } from "./types.js";
```

- [ ] **Step 8: Create `packages/session/src/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/session public surface", () => {
  it("exports the documented surface only", () => {
    // Types erase at runtime — surface is whatever Tasks 2/3 add. Placeholder
    // assertion replaced when those tasks land; the test exists from T1 so
    // every later task knows the barrel test is the gate.
    expect(typeof api).toBe("object");
  });
});
```

- [ ] **Step 9: Update root `pnpm-workspace.yaml`** if needed

Run: `cat pnpm-workspace.yaml`
Expected: `packages/*` already covers `packages/session`. No edit needed.

- [ ] **Step 10: Install + verify scaffold typechecks**

```bash
pnpm install
pnpm --filter @technical-1/session run build
pnpm --filter @technical-1/session run test
pnpm --filter @technical-1/session run lint
```

Expected: build emits `dist/index.{js,cjs,d.ts,d.cts}`, test passes (1 placeholder), lint clean.

- [ ] **Step 11: Commit**

```bash
git add packages/session pnpm-lock.yaml
git commit -m "feat(session): scaffold package (P6T1)"
```

---

### Task 2: Session — pure `captureSession` / `restoreSession` (TDD)

**Files:**
- Modify: `packages/session/src/types.ts` (already complete from T1; verify still satisfies)
- Create: `packages/session/src/snapshot.ts`
- Create: `packages/session/src/snapshot.test.ts`

The pure functions: capture reads cookies via `page.browserContext().cookies()` and storage via `page.evaluate(() => …localStorage…)`; restore writes cookies via `page.browserContext().setCookie(...)` and storage via `page.evaluateOnNewDocument(() => …localStorage…)`. Throws `SessionError` wrapping any underlying failure.

**Why `BrowserContext` and not `Page` for cookies?** puppeteer-core 24.x deprecated the page-level cookie API in favor of the browser/context-level one (`page.cookies()` still works but emits a deprecation warning; `BrowserContext.cookies()` is the supported path). `page.browserContext()` is a synchronous accessor, so threading the context out of the `Page` we already accept keeps the public signature `captureSession(page)` unchanged — only the internals shift. This matches the Plan 05 `setUserAgent({userAgent})` object-form pivot.

Both functions still hit the cemented **module-scoped `declare var`** convention because they pass callbacks to `page.evaluate`/`page.evaluateOnNewDocument` that reference in-page globals (`localStorage`, `sessionStorage`).

- [ ] **Step 1: Write the failing test — capture happy path**

Create `packages/session/src/snapshot.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { BrowserContext, Cookie, Page } from "puppeteer-core";
import { captureSession, restoreSession } from "./snapshot.js";

// Cookie fixture — sourceScheme must be one of "Unset" | "NonSecure" | "Secure"
// per puppeteer-core 24.x's CookieSourceScheme enum. Cast via `unknown` because
// the strict `Cookie` type carries a handful of optional fields irrelevant to
// these tests.
const sampleCookies: Cookie[] = [
  {
    name: "sid",
    value: "abc",
    domain: "example.com",
    path: "/",
    expires: -1,
    size: 0,
    httpOnly: false,
    secure: false,
    session: true,
    sameParty: false,
    sourceScheme: "NonSecure",
    sourcePort: 80,
  } as unknown as Cookie,
];

function pageMock(opts: {
  cookies?: Cookie[];
  storage?: { local: Record<string, string>; session: Record<string, string> };
} = {}): Page {
  const ctx = {
    cookies: vi.fn().mockResolvedValue(opts.cookies ?? []),
    setCookie: vi.fn().mockResolvedValue(undefined),
  } as unknown as BrowserContext;
  return {
    browserContext: () => ctx,
    evaluate: vi.fn().mockResolvedValue(
      opts.storage ?? { local: {}, session: {} },
    ),
    evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe("captureSession", () => {
  it("returns cookies + localStorage + sessionStorage + capturedAt", async () => {
    const page = pageMock({
      cookies: sampleCookies,
      storage: { local: { foo: "1" }, session: { bar: "2" } },
    });

    const snap = await captureSession(page);

    expect(snap.cookies).toEqual(sampleCookies);
    expect(snap.localStorage).toEqual({ foo: "1" });
    expect(snap.sessionStorage).toEqual({ bar: "2" });
    expect(new Date(snap.capturedAt).toString()).not.toBe("Invalid Date");
  });

  it("wraps puppeteer errors in SessionError with retryable:false and cause", async () => {
    const ctx = {
      cookies: vi.fn().mockRejectedValue(new Error("CDP closed")),
    } as unknown as BrowserContext;
    const page = {
      browserContext: () => ctx,
      evaluate: vi.fn(),
    } as unknown as Page;

    await expect(captureSession(page)).rejects.toMatchObject({
      name: "SessionError",
      retryable: false,
      cause: expect.objectContaining({ message: "CDP closed" }),
    });
  });
});

describe("restoreSession", () => {
  it("calls ctx.setCookie with the spread snapshot cookies + writes storage via evaluateOnNewDocument", async () => {
    const page = pageMock();
    await restoreSession(page, {
      cookies: sampleCookies,
      localStorage: { foo: "1" },
      sessionStorage: { bar: "2" },
      capturedAt: new Date().toISOString(),
    });

    expect(page.browserContext().setCookie).toHaveBeenCalledWith(...sampleCookies);
    expect(page.evaluateOnNewDocument).toHaveBeenCalledOnce();
  });

  it("skips setCookie when snapshot has no cookies (puppeteer rejects empty rest args on some versions)", async () => {
    const page = pageMock();
    await restoreSession(page, {
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      capturedAt: new Date().toISOString(),
    });

    expect(page.browserContext().setCookie).not.toHaveBeenCalled();
  });

  it("wraps puppeteer errors in SessionError with retryable:false and cause", async () => {
    const ctx = {
      setCookie: vi.fn().mockRejectedValue(new Error("frame detached")),
    } as unknown as BrowserContext;
    const page = {
      browserContext: () => ctx,
      evaluateOnNewDocument: vi.fn(),
    } as unknown as Page;

    await expect(
      restoreSession(page, {
        cookies: sampleCookies,
        localStorage: {},
        sessionStorage: {},
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({
      name: "SessionError",
      retryable: false,
      cause: expect.objectContaining({ message: "frame detached" }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @technical-1/session test`
Expected: FAIL — `Cannot find module './snapshot.js'`

- [ ] **Step 3: Implement `packages/session/src/snapshot.ts`**

```ts
import { SessionError } from "@technical-1/core";
import type { Page } from "puppeteer-core";
import type { SessionSnapshot } from "./types.js";

// In-page globals referenced inside the evaluate callbacks below. Declared
// module-scoped so the file's TypeScript stays Node-only (no DOM lib).
declare var localStorage: { length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void };
declare var sessionStorage: { length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void };

/**
 * Read all cookies + localStorage + sessionStorage from `page`. Returns a
 * plain JSON-serializable snapshot.
 *
 * Cookies come from `page.browserContext().cookies()` — the non-deprecated
 * v24 path. (page-level cookie APIs emit a deprecation warning.)
 *
 * Throws `SessionError` (terminal — `retryable:false`) wrapping any
 * puppeteer-core / page failure as `cause`.
 */
export async function captureSession(page: Page): Promise<SessionSnapshot> {
  try {
    const cookies = await page.browserContext().cookies();
    const storage = await page.evaluate(() => {
      const dump = (s: typeof localStorage): Record<string, string> => {
        const out: Record<string, string> = {};
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (k !== null) {
            const v = s.getItem(k);
            if (v !== null) out[k] = v;
          }
        }
        return out;
      };
      return { local: dump(localStorage), session: dump(sessionStorage) };
    });

    return {
      cookies,
      localStorage: storage.local,
      sessionStorage: storage.session,
      capturedAt: new Date().toISOString(),
    };
  } catch (cause) {
    throw new SessionError("captureSession failed", { cause });
  }
}

/**
 * Apply a `SessionSnapshot` to `page`: sets cookies on `page.browserContext()`
 * (the non-deprecated v24 path) and queues the storage write via
 * `evaluateOnNewDocument` so it lands BEFORE the next navigation. Caller
 * must navigate to a matching origin to observe the restored storage
 * (browsers scope storage to origin).
 *
 * Throws `SessionError` (terminal — `retryable:false`) wrapping any failure.
 */
export async function restoreSession(
  page: Page,
  snapshot: SessionSnapshot,
): Promise<void> {
  try {
    if (snapshot.cookies.length > 0) {
      await page.browserContext().setCookie(...snapshot.cookies);
    }
    await page.evaluateOnNewDocument(
      (local: Record<string, string>, session: Record<string, string>) => {
        for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, v);
      },
      snapshot.localStorage,
      snapshot.sessionStorage,
    );
  } catch (cause) {
    throw new SessionError("restoreSession failed", { cause });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @technical-1/session test`
Expected: 5/5 snapshot tests + 1 index placeholder = 6 PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter @technical-1/session lint && pnpm --filter @technical-1/session build`
Expected: 0 warnings, dual build emits `dist/index.d.cts` (verify with `ls packages/session/dist/`).

- [ ] **Step 6: Commit**

```bash
git add packages/session/src/snapshot.ts packages/session/src/snapshot.test.ts
git commit -m "feat(session): pure captureSession/restoreSession (P6T2)"
```

---

### Task 3: Session — `Session` class store + barrel + dual build verify

**Files:**
- Create: `packages/session/src/store.ts`
- Create: `packages/session/src/store.test.ts`
- Modify: `packages/session/src/index.ts`
- Modify: `packages/session/src/index.test.ts`

- [ ] **Step 1: Write the failing test — Session class**

Create `packages/session/src/store.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { BrowserContext, Page } from "puppeteer-core";
import { Session } from "./store.js";

function pageMock(): Page {
  const ctx = {
    cookies: vi.fn().mockResolvedValue([]),
    setCookie: vi.fn().mockResolvedValue(undefined),
  } as unknown as BrowserContext;
  return {
    browserContext: () => ctx,
    evaluate: vi.fn().mockResolvedValue({ local: { k: "v" }, session: {} }),
    evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe("Session store", () => {
  it("save() captures and stores under the label, returning the snapshot", async () => {
    const store = new Session();
    const snap = await store.save(pageMock(), "alice");

    expect(snap.localStorage).toEqual({ k: "v" });
    expect(store.get("alice")).toBe(snap);
  });

  it("load() restores from the stored snapshot to the given page", async () => {
    const store = new Session();
    await store.save(pageMock(), "alice");

    const otherPage = pageMock();
    await store.load(otherPage, "alice");

    expect(otherPage.evaluateOnNewDocument).toHaveBeenCalledOnce();
  });

  it("load() throws SessionError (retryable:false) when label is unknown", async () => {
    const store = new Session();

    await expect(store.load(pageMock(), "ghost")).rejects.toMatchObject({
      name: "SessionError",
      retryable: false,
    });
  });

  it("set/get/delete/list manage the in-memory store deterministically", () => {
    const store = new Session();
    const snap = {
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      capturedAt: new Date().toISOString(),
    };

    store.set("a", snap);
    store.set("b", snap);

    expect(store.list().sort()).toEqual(["a", "b"]);
    expect(store.delete("a")).toBe(true);
    expect(store.delete("a")).toBe(false);
    expect(store.list()).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @technical-1/session test`
Expected: FAIL — `Cannot find module './store.js'`.

- [ ] **Step 3: Implement `packages/session/src/store.ts`**

```ts
import { SessionError } from "@technical-1/core";
import type { Page } from "puppeteer-core";
import { captureSession, restoreSession } from "./snapshot.js";
import type { SessionSnapshot } from "./types.js";

/**
 * In-memory label-keyed store of `SessionSnapshot`s. Thin wrapper over the
 * pure `captureSession`/`restoreSession` functions for multi-account flows.
 *
 * Not persisted to disk in v1 — call `JSON.stringify(session.get(label))`
 * yourself if you want filesystem persistence.
 */
export class Session {
  readonly #store = new Map<string, SessionSnapshot>();

  /** Capture `page`'s state and store it under `label`. Returns the snapshot. */
  async save(page: Page, label: string): Promise<SessionSnapshot> {
    const snap = await captureSession(page);
    this.#store.set(label, snap);
    return snap;
  }

  /**
   * Restore the snapshot stored under `label` to `page`.
   *
   * Throws `SessionError` (`retryable:false`) when no snapshot exists for
   * the label.
   */
  async load(page: Page, label: string): Promise<void> {
    const snap = this.#store.get(label);
    if (snap === undefined) {
      throw new SessionError(`No session stored under label: ${label}`, {
        context: { label },
      });
    }
    await restoreSession(page, snap);
  }

  get(label: string): SessionSnapshot | undefined {
    return this.#store.get(label);
  }

  set(label: string, snapshot: SessionSnapshot): void {
    this.#store.set(label, snapshot);
  }

  delete(label: string): boolean {
    return this.#store.delete(label);
  }

  list(): string[] {
    return [...this.#store.keys()];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @technical-1/session test`
Expected: 4 store + 5 snapshot + 1 index = 10 PASS.

- [ ] **Step 5: Update `packages/session/src/index.ts` — final barrel**

```ts
export type { SessionSnapshot } from "./types.js";
export { captureSession, restoreSession } from "./snapshot.js";
export { Session } from "./store.js";
```

- [ ] **Step 6: Update `packages/session/src/index.test.ts` — barrel test**

```ts
import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/session public surface", () => {
  it("exports exactly the documented surface", () => {
    // Types erase at runtime — only runtime values appear here.
    expect(Object.keys(api).sort()).toEqual(
      ["Session", "captureSession", "restoreSession"].sort(),
    );
  });
});
```

- [ ] **Step 7: Verify build, lint, test all clean**

```bash
pnpm --filter @technical-1/session build
pnpm --filter @technical-1/session lint
pnpm --filter @technical-1/session test
ls packages/session/dist/
```

Expected: build emits `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`. 10 tests PASS. 0 lint warnings.

- [ ] **Step 8: Commit**

```bash
git add packages/session/src/store.ts packages/session/src/store.test.ts packages/session/src/index.ts packages/session/src/index.test.ts
git commit -m "feat(session): Session class store + final barrel (P6T3)"
```

---

### Task 4: Network — scaffold

**Files:**
- Create: `packages/network/package.json`
- Create: `packages/network/tsconfig.json`
- Create: `packages/network/tsup.config.ts`
- Create: `packages/network/vitest.config.ts`
- Create: `packages/network/README.md`
- Create: `packages/network/src/types.ts`
- Create: `packages/network/src/index.ts`
- Create: `packages/network/src/index.test.ts`

- [ ] **Step 1: Create `packages/network/package.json`**

```json
{
  "name": "@technical-1/network",
  "version": "0.0.0",
  "description": "Request blocking, response capture, and network throttling / offline emulation for Puppeteer pages.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@technical-1/core": "workspace:*"
  },
  "peerDependencies": {
    "puppeteer-core": ">=22 <25"
  },
  "devDependencies": {
    "puppeteer-core": "^24.4.0"
  },
  "sideEffects": false,
  "license": "MIT",
  "publishConfig": { "access": "public" }
}
```

> See the note under P6T1 Step 1 for why `puppeteer-core` appears in BOTH
> `peerDependencies` and `devDependencies` on browser-driving packages.

- [ ] **Step 2: Create `packages/network/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/network/tsup.config.ts`**

```ts
export { default } from "../../tsup.config.base.js";
```

- [ ] **Step 4: Create `packages/network/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 5: Create `packages/network/README.md`**

```markdown
# @technical-1/network

Request blocking, response capture, and network throttling / offline
emulation for Puppeteer pages. Function-first surface; no class state.

```ts
import {
  blockResources,
  unblockResources,
  captureResponses,
  throttle,
  setOffline,
  THROTTLE_PROFILES,
} from "@technical-1/network";

// Block images + analytics URLs:
await blockResources(page, ["image", /google-analytics/]);

// Capture all responses:
const collector = await captureResponses(page);
// … run navigation …
console.log(collector.responses.length);
collector.stop();

// Throttle to Fast 3G:
await throttle(page, THROTTLE_PROFILES.FAST_3G);

// Go offline:
await setOffline(page, true);
```

## v1 limitations

- `captureResponses` records `{url, status, method, resourceType, timestamp}`.
  Does NOT capture headers or response bodies — full HAR-1.2 emission is the
  v2 surface noted in spec §5.
- `throttle` uses CDP `Network.emulateNetworkConditions`. Does NOT throttle
  WebSocket / WebRTC (CDP limitation).
- `blockResources` patterns are `ResourceType` strings (exact match) or
  `RegExp` (URL match). Globs are not supported in v1.

## Errors

Throws `PptrKitError` from `@technical-1/core` wrapping the underlying
puppeteer-core / CDP failure as `cause`. Transient I/O (`offline:true`
applied while the page was navigating) is `retryable:true`; programmer
errors (empty pattern list) are `retryable:false`.

## Peer

Requires `puppeteer-core` `>=22 <25`.
```

- [ ] **Step 6: Create `packages/network/src/types.ts`**

```ts
import type { ResourceType } from "puppeteer-core";

/** A request-blocking pattern. */
export type BlockPattern = ResourceType | RegExp;

/** A single captured response. */
export interface ResponseRecord {
  url: string;
  status: number;
  method: string;
  resourceType: ResourceType;
  /** `Date.now()` at the moment puppeteer fired the response event. */
  timestamp: number;
}

/** Handle returned by `captureResponses`. */
export interface ResponseCollector {
  /** Caller-readable snapshot. Updated live as responses arrive. */
  readonly responses: ReadonlyArray<ResponseRecord>;
  /** Unsubscribe from page response events. Idempotent. */
  stop(): void;
}

/** Network throttle profile (Chrome DevTools Protocol shape). */
export interface ThrottleProfile {
  /** `true` to simulate offline (overrides throughput/latency). */
  offline: boolean;
  /** Download throughput in bytes/sec. `-1` disables download throttling. */
  downloadThroughput: number;
  /** Upload throughput in bytes/sec. `-1` disables upload throttling. */
  uploadThroughput: number;
  /** Round-trip latency in milliseconds. */
  latency: number;
}
```

- [ ] **Step 7: Create `packages/network/src/index.ts`**

```ts
// Public surface — filled in by Tasks 5–8.
export type {
  BlockPattern,
  ResponseRecord,
  ResponseCollector,
  ThrottleProfile,
} from "./types.js";
```

- [ ] **Step 8: Create `packages/network/src/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/network public surface", () => {
  it("exports the documented surface only", () => {
    // Types erase at runtime — surface filled in by Tasks 5–8.
    expect(typeof api).toBe("object");
  });
});
```

- [ ] **Step 9: Install + verify scaffold**

```bash
pnpm install
pnpm --filter @technical-1/network run build
pnpm --filter @technical-1/network run test
pnpm --filter @technical-1/network run lint
```

Expected: build emits `dist/index.{js,cjs,d.ts,d.cts}`, 1 placeholder test passes, lint clean.

- [ ] **Step 10: Commit**

```bash
git add packages/network pnpm-lock.yaml
git commit -m "feat(network): scaffold package (P6T4)"
```

---

### Task 5: Network — `blockResources` / `unblockResources` (TDD)

**Files:**
- Create: `packages/network/src/blocking.ts`
- Create: `packages/network/src/blocking.test.ts`

`blockResources` enables request interception and aborts matching requests; `unblockResources` disables interception. The matching is: a `ResourceType` string matches `request.resourceType()` exactly; a `RegExp` matches against `request.url()`.

The implementation must be **idempotent** — calling `blockResources` twice on the same page must not double-register listeners. We achieve this by stashing the listener on a `WeakMap<Page, Listener>` so unblock can find it.

- [ ] **Step 1: Write the failing test**

Create `packages/network/src/blocking.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, Page, ResourceType } from "puppeteer-core";
import { blockResources, unblockResources } from "./blocking.js";

interface FakeRequestArgs {
  url?: string;
  resourceType?: ResourceType;
}

function fakeRequest({ url = "https://example.com/x", resourceType = "document" as ResourceType }: FakeRequestArgs = {}): HTTPRequest {
  return {
    url: () => url,
    resourceType: () => resourceType,
    abort: vi.fn().mockResolvedValue(undefined),
    continue: vi.fn().mockResolvedValue(undefined),
  } as unknown as HTTPRequest;
}

function pageMock() {
  const listeners = new Map<string, (req: HTTPRequest) => unknown>();
  const page = {
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, fn: (req: HTTPRequest) => unknown) => {
      listeners.set(event, fn);
      return page;
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
      return page;
    }),
  } as unknown as Page & { _emit: (event: string, req: HTTPRequest) => Promise<void> };
  (page as { _emit: (event: string, req: HTTPRequest) => Promise<void> })._emit = async (event, req) => {
    const fn = listeners.get(event);
    if (fn !== undefined) await fn(req);
  };
  return page;
}

describe("blockResources", () => {
  it("aborts requests matching a ResourceType string", async () => {
    const page = pageMock();
    await blockResources(page, ["image"]);

    const imgReq = fakeRequest({ resourceType: "image" });
    const docReq = fakeRequest({ resourceType: "document" });
    await page._emit("request", imgReq);
    await page._emit("request", docReq);

    expect(imgReq.abort).toHaveBeenCalledOnce();
    expect(docReq.abort).not.toHaveBeenCalled();
    expect(docReq.continue).toHaveBeenCalledOnce();
  });

  it("aborts requests matching a RegExp URL pattern", async () => {
    const page = pageMock();
    await blockResources(page, [/analytics/]);

    const blocked = fakeRequest({ url: "https://google-analytics.com/x" });
    const allowed = fakeRequest({ url: "https://example.com/" });
    await page._emit("request", blocked);
    await page._emit("request", allowed);

    expect(blocked.abort).toHaveBeenCalledOnce();
    expect(allowed.continue).toHaveBeenCalledOnce();
  });

  it("enables setRequestInterception(true) exactly once even on repeat calls", async () => {
    const page = pageMock();
    await blockResources(page, ["image"]);
    await blockResources(page, ["image", "stylesheet"]);

    expect(page.setRequestInterception).toHaveBeenCalledTimes(1);
  });

  it("merges patterns across repeat calls", async () => {
    const page = pageMock();
    await blockResources(page, ["image"]);
    await blockResources(page, [/analytics/]);

    const img = fakeRequest({ resourceType: "image" });
    const analytics = fakeRequest({ url: "https://analytics.example.com/x" });
    await page._emit("request", img);
    await page._emit("request", analytics);

    expect(img.abort).toHaveBeenCalledOnce();
    expect(analytics.abort).toHaveBeenCalledOnce();
  });

  it("throws PptrKitError (retryable:false) for an empty pattern list", async () => {
    const page = pageMock();
    await expect(blockResources(page, [])).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: false,
    });
  });
});

describe("unblockResources", () => {
  it("disables interception and detaches the listener", async () => {
    const page = pageMock();
    await blockResources(page, ["image"]);
    await unblockResources(page);

    expect(page.setRequestInterception).toHaveBeenLastCalledWith(false);
    expect(page.off).toHaveBeenCalled();

    // After unblock, a fresh blockResources call must re-enable interception.
    await blockResources(page, ["image"]);
    expect(page.setRequestInterception).toHaveBeenCalledTimes(3); // true, false, true
  });

  it("is idempotent when interception was never enabled", async () => {
    const page = pageMock();
    await expect(unblockResources(page)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @technical-1/network test`
Expected: FAIL — `Cannot find module './blocking.js'`.

- [ ] **Step 3: Implement `packages/network/src/blocking.ts`**

```ts
import { PptrKitError } from "@technical-1/core";
import type { HTTPRequest, Page } from "puppeteer-core";
import type { BlockPattern } from "./types.js";

interface BlockingState {
  patterns: BlockPattern[];
  listener: (req: HTTPRequest) => Promise<void>;
}

/**
 * Per-page registry of the blocking listener and accumulated patterns. We
 * keep the live patterns array shared with the closure so repeat
 * `blockResources` calls merge into the same listener — avoids double-
 * registration and the puppeteer-core "request already handled" error.
 *
 * Weak so the registry follows the page's lifetime (GC-clean).
 */
const STATE: WeakMap<Page, BlockingState> = new WeakMap();

function matches(req: HTTPRequest, patterns: readonly BlockPattern[]): boolean {
  for (const p of patterns) {
    if (typeof p === "string") {
      if (req.resourceType() === p) return true;
    } else if (p.test(req.url())) {
      return true;
    }
  }
  return false;
}

/**
 * Enable request interception on `page` and abort requests matching any of
 * `patterns`. A `ResourceType` string (e.g. `"image"`, `"stylesheet"`)
 * matches the request's resource type exactly; a `RegExp` matches the
 * request URL.
 *
 * Idempotent across repeat calls — patterns from subsequent calls merge
 * into the live listener.
 *
 * Throws `PptrKitError` (`retryable:false`) when called with an empty
 * pattern list (programmer error).
 */
export async function blockResources(
  page: Page,
  patterns: readonly BlockPattern[],
): Promise<void> {
  if (patterns.length === 0) {
    throw new PptrKitError("blockResources requires at least one pattern", {
      retryable: false,
    });
  }

  const existing = STATE.get(page);
  if (existing !== undefined) {
    existing.patterns.push(...patterns);
    return;
  }

  const live: BlockPattern[] = [...patterns];
  const listener = async (req: HTTPRequest): Promise<void> => {
    try {
      if (matches(req, live)) await req.abort();
      else await req.continue();
    } catch {
      // Race: request was already handled by another listener — swallow.
      // (Cross-realm safety; puppeteer-core throws on double-handle.)
    }
  };

  await page.setRequestInterception(true);
  page.on("request", listener);
  STATE.set(page, { patterns: live, listener });
}

/**
 * Disable request interception on `page` and detach the blocking listener
 * installed by `blockResources`. Idempotent — safe to call when no
 * interception was active.
 */
export async function unblockResources(page: Page): Promise<void> {
  const state = STATE.get(page);
  if (state === undefined) return;
  page.off("request", state.listener);
  STATE.delete(page);
  await page.setRequestInterception(false);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @technical-1/network test`
Expected: 5 + 2 + 1 = 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/network/src/blocking.ts packages/network/src/blocking.test.ts
git commit -m "feat(network): blockResources / unblockResources (P6T5)"
```

---

### Task 6: Network — `captureResponses` (TDD)

**Files:**
- Create: `packages/network/src/responses.ts`
- Create: `packages/network/src/responses.test.ts`

`captureResponses(page, opts?)` subscribes to `page.on('response', …)`, records `{url, status, method, resourceType, timestamp}` into a mutable list, and returns a `ResponseCollector` exposing the list + a `stop()` to unsubscribe. Optional filter: `opts.include` array of `ResourceType` to keep only matching responses.

- [ ] **Step 1: Write the failing test**

Create `packages/network/src/responses.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, HTTPResponse, Page, ResourceType } from "puppeteer-core";
import { captureResponses } from "./responses.js";

function fakeResponse(opts: {
  url?: string;
  status?: number;
  method?: string;
  resourceType?: ResourceType;
} = {}): HTTPResponse {
  const req = {
    method: () => opts.method ?? "GET",
    resourceType: () => (opts.resourceType ?? "document") as ResourceType,
  } as unknown as HTTPRequest;
  return {
    url: () => opts.url ?? "https://example.com/x",
    status: () => opts.status ?? 200,
    request: () => req,
  } as unknown as HTTPResponse;
}

function pageMock() {
  const listeners = new Map<string, (res: HTTPResponse) => void>();
  const page = {
    on: vi.fn((event: string, fn: (res: HTTPResponse) => void) => {
      listeners.set(event, fn);
      return page;
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
      return page;
    }),
  } as unknown as Page & { _emit: (event: string, res: HTTPResponse) => void };
  (page as { _emit: (event: string, res: HTTPResponse) => void })._emit = (event, res) => {
    listeners.get(event)?.(res);
  };
  return page;
}

describe("captureResponses", () => {
  it("records each response with url/status/method/resourceType/timestamp", async () => {
    const page = pageMock();
    const collector = await captureResponses(page);

    page._emit("response", fakeResponse({ url: "https://a/", status: 200, method: "GET", resourceType: "document" }));
    page._emit("response", fakeResponse({ url: "https://b/", status: 404, method: "POST", resourceType: "xhr" }));

    expect(collector.responses).toHaveLength(2);
    expect(collector.responses[0]).toMatchObject({
      url: "https://a/",
      status: 200,
      method: "GET",
      resourceType: "document",
    });
    expect(collector.responses[1]).toMatchObject({
      url: "https://b/",
      status: 404,
      method: "POST",
      resourceType: "xhr",
    });
    expect(typeof collector.responses[0]!.timestamp).toBe("number");
  });

  it("filters by `include` resource types", async () => {
    const page = pageMock();
    const collector = await captureResponses(page, { include: ["xhr", "fetch"] });

    page._emit("response", fakeResponse({ resourceType: "document" }));
    page._emit("response", fakeResponse({ resourceType: "xhr" }));
    page._emit("response", fakeResponse({ resourceType: "fetch" }));
    page._emit("response", fakeResponse({ resourceType: "image" }));

    expect(collector.responses.map(r => r.resourceType)).toEqual(["xhr", "fetch"]);
  });

  it("stop() detaches the listener and is idempotent", async () => {
    const page = pageMock();
    const collector = await captureResponses(page);

    page._emit("response", fakeResponse({ url: "https://a/" }));
    collector.stop();
    page._emit("response", fakeResponse({ url: "https://b/" })); // ignored — listener detached
    collector.stop(); // idempotent

    expect(collector.responses).toHaveLength(1);
    expect(page.off).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @technical-1/network test`
Expected: FAIL — `Cannot find module './responses.js'`.

- [ ] **Step 3: Implement `packages/network/src/responses.ts`**

```ts
import type { HTTPResponse, Page, ResourceType } from "puppeteer-core";
import type { ResponseCollector, ResponseRecord } from "./types.js";

export interface CaptureResponsesOptions {
  /** Optional allow-list of resource types. Omit to capture everything. */
  include?: readonly ResourceType[];
}

/**
 * Subscribe to `page.on('response', …)` and record a minimal summary of each
 * response. Returns a `ResponseCollector` whose `responses` array is mutable
 * (read at any time) and whose `stop()` detaches the listener.
 *
 * v1 records `{url, status, method, resourceType, timestamp}` only — no
 * headers, no bodies. Full HAR-1.2 emission is the v2 surface (spec §5).
 */
export async function captureResponses(
  page: Page,
  opts: CaptureResponsesOptions = {},
): Promise<ResponseCollector> {
  const include = opts.include;
  const records: ResponseRecord[] = [];

  const listener = (res: HTTPResponse): void => {
    const req = res.request();
    const resourceType = req.resourceType();
    if (include !== undefined && !include.includes(resourceType)) return;
    records.push({
      url: res.url(),
      status: res.status(),
      method: req.method(),
      resourceType,
      timestamp: Date.now(),
    });
  };

  page.on("response", listener);
  let stopped = false;

  return {
    responses: records,
    stop(): void {
      if (stopped) return;
      stopped = true;
      page.off("response", listener);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @technical-1/network test`
Expected: 3 + 7 + 1 = 11 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/network/src/responses.ts packages/network/src/responses.test.ts
git commit -m "feat(network): captureResponses with optional include filter (P6T6)"
```

---

### Task 7: Network — `setOffline` / `throttle` + `THROTTLE_PROFILES` (TDD)

**Files:**
- Create: `packages/network/src/throttling.ts`
- Create: `packages/network/src/throttling.test.ts`

Both functions go through a `CDPSession` obtained from `page.target().createCDPSession()`. `setOffline` is a thin convenience that calls `throttle` with the OFFLINE profile.

Profiles come from the Chrome DevTools standard presets. Sources documented in code.

- [ ] **Step 1: Write the failing test**

Create `packages/network/src/throttling.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { CDPSession, Page } from "puppeteer-core";
import { setOffline, throttle, THROTTLE_PROFILES } from "./throttling.js";

function pageMock() {
  const send = vi.fn().mockResolvedValue(undefined);
  const session = { send } as unknown as CDPSession;
  const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
  const page = { target: () => target } as unknown as Page;
  return { page, send, target };
}

describe("throttle", () => {
  it("sends Network.emulateNetworkConditions with the profile", async () => {
    const { page, send } = pageMock();
    await throttle(page, THROTTLE_PROFILES.SLOW_3G);

    expect(send).toHaveBeenCalledWith(
      "Network.emulateNetworkConditions",
      THROTTLE_PROFILES.SLOW_3G,
    );
  });

  it("wraps CDP failures in PptrKitError (retryable:true)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("CDP closed"));
    const session = { send } as unknown as CDPSession;
    const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
    const page = { target: () => target } as unknown as Page;

    await expect(throttle(page, THROTTLE_PROFILES.FAST_3G)).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: expect.objectContaining({ message: "CDP closed" }),
    });
  });
});

describe("setOffline", () => {
  it("setOffline(page, true) sends the OFFLINE profile", async () => {
    const { page, send } = pageMock();
    await setOffline(page, true);

    expect(send).toHaveBeenCalledWith(
      "Network.emulateNetworkConditions",
      THROTTLE_PROFILES.OFFLINE,
    );
  });

  it("setOffline(page, false) sends the NO_THROTTLE profile (offline:false, throughput:-1)", async () => {
    const { page, send } = pageMock();
    await setOffline(page, false);

    expect(send).toHaveBeenCalledWith(
      "Network.emulateNetworkConditions",
      THROTTLE_PROFILES.NO_THROTTLE,
    );
  });
});

describe("THROTTLE_PROFILES", () => {
  it("exposes the canonical DevTools presets with the expected shape", () => {
    expect(THROTTLE_PROFILES.OFFLINE.offline).toBe(true);
    expect(THROTTLE_PROFILES.NO_THROTTLE.offline).toBe(false);
    expect(THROTTLE_PROFILES.NO_THROTTLE.downloadThroughput).toBe(-1);
    expect(THROTTLE_PROFILES.SLOW_3G.offline).toBe(false);
    expect(THROTTLE_PROFILES.FAST_3G.latency).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @technical-1/network test`
Expected: FAIL — `Cannot find module './throttling.js'`.

- [ ] **Step 3: Implement `packages/network/src/throttling.ts`**

```ts
import { PptrKitError } from "@technical-1/core";
import type { Page } from "puppeteer-core";
import type { ThrottleProfile } from "./types.js";

/**
 * Canonical Chrome DevTools network condition presets.
 *
 * Throughput is in bytes/sec; `-1` disables throttling on that axis.
 * Values match the DevTools UI dropdown ("Slow 3G", "Fast 3G", etc.) —
 * see https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions
 *
 * Frozen so callers can't accidentally mutate them.
 */
export const THROTTLE_PROFILES = Object.freeze({
  OFFLINE: Object.freeze<ThrottleProfile>({
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  }),
  NO_THROTTLE: Object.freeze<ThrottleProfile>({
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  }),
  SLOW_3G: Object.freeze<ThrottleProfile>({
    offline: false,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
    latency: 400,
  }),
  FAST_3G: Object.freeze<ThrottleProfile>({
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  }),
});

export type ThrottleProfileName = keyof typeof THROTTLE_PROFILES;

/**
 * Emulate `profile`'s network conditions on `page` via CDP. Throws
 * `PptrKitError` (`retryable:true` — the failure mode is usually a closed
 * session that succeeds after a fresh page) wrapping the underlying error
 * as `cause`.
 */
export async function throttle(page: Page, profile: ThrottleProfile): Promise<void> {
  try {
    const cdp = await page.target().createCDPSession();
    await cdp.send("Network.emulateNetworkConditions", profile);
  } catch (cause) {
    throw new PptrKitError("throttle failed", { retryable: true, cause });
  }
}

/**
 * Toggle offline emulation on `page`. Convenience over `throttle` with the
 * `OFFLINE` / `NO_THROTTLE` profiles.
 */
export async function setOffline(page: Page, offline: boolean): Promise<void> {
  await throttle(
    page,
    offline ? THROTTLE_PROFILES.OFFLINE : THROTTLE_PROFILES.NO_THROTTLE,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @technical-1/network test`
Expected: 5 + 7 + 3 + 1 = 16 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/network/src/throttling.ts packages/network/src/throttling.test.ts
git commit -m "feat(network): throttle / setOffline + THROTTLE_PROFILES (P6T7)"
```

---

### Task 8: Network — barrel + dual build verify

**Files:**
- Modify: `packages/network/src/index.ts`
- Modify: `packages/network/src/index.test.ts`

- [ ] **Step 1: Update `packages/network/src/index.ts` — final barrel**

```ts
export type {
  BlockPattern,
  ResponseRecord,
  ResponseCollector,
  ThrottleProfile,
} from "./types.js";

export { blockResources, unblockResources } from "./blocking.js";
export { captureResponses } from "./responses.js";
export type { CaptureResponsesOptions } from "./responses.js";
export {
  throttle,
  setOffline,
  THROTTLE_PROFILES,
} from "./throttling.js";
export type { ThrottleProfileName } from "./throttling.js";
```

- [ ] **Step 2: Update `packages/network/src/index.test.ts` — barrel test**

```ts
import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/network public surface", () => {
  it("exports exactly the documented surface", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "THROTTLE_PROFILES",
        "blockResources",
        "captureResponses",
        "setOffline",
        "throttle",
        "unblockResources",
      ].sort(),
    );
  });
});
```

- [ ] **Step 3: Verify build, lint, test all clean**

```bash
pnpm --filter @technical-1/network build
pnpm --filter @technical-1/network lint
pnpm --filter @technical-1/network test
ls packages/network/dist/
```

Expected: build emits `index.{js,cjs,d.ts,d.cts}`. 16 tests PASS. 0 lint warnings.

- [ ] **Step 4: Commit**

```bash
git add packages/network/src/index.ts packages/network/src/index.test.ts
git commit -m "feat(network): expose public surface; verify dual build (P6T8)"
```

---

### Task 9: Changeset + monorepo CI gate

**Files:**
- Create: `.changeset/state-traffic.md`

- [ ] **Step 1: Create `.changeset/state-traffic.md`**

```markdown
---
"@technical-1/session": minor
"@technical-1/network": minor
---

State & traffic tier: `session` (cookie + localStorage + sessionStorage
snapshots with a label-keyed `Session` class store) and `network`
(`blockResources`/`unblockResources` request blocking, `captureResponses`
mutable response collector, `throttle`/`setOffline` + `THROTTLE_PROFILES`
CDP network emulation). Both declare `@technical-1/core` as a dependency
and `puppeteer-core` `>=22 <25` as a peer. `session` throws `SessionError`
(terminal); `network` wraps externals in `PptrKitError` with explicit
`retryable` (`true` for transient CDP failures, `false` for programmer
errors like empty pattern lists).
```

- [ ] **Step 2: Run the whole-monorepo CI gate**

```bash
pnpm turbo run lint test build --output-logs=errors-only
```

Expected: 45 successful tasks (lint + test + build × 15 packages), 0 failures. Test count: P5 closed at 116; P6 adds session (10) + network (16) = 26 → 142 monorepo total.

- [ ] **Step 3: Commit**

```bash
git add .changeset/state-traffic.md
git commit -m "chore: changeset for the state-traffic tier (P6T9)"
```

---

## Self-review checklist

After all tasks complete, verify before the holistic review:

- [ ] All 9 tasks have passing tests
- [ ] `pnpm turbo run lint test build` exits 0
- [ ] `pnpm changeset status` reports the 2 packages bumped
- [ ] `grep -ri autom8ops packages/ .changeset/` returns 0 matches
- [ ] `git log feat/06-state-traffic --not main --format='%an <%ae>' | sort -u` shows only `Jacob Kanfer <kanfer@users.noreply.github.com>`
- [ ] Both new packages emit `dist/index.d.cts` (the CJS-types check)
- [ ] Both `index.test.ts` files use exact `Object.keys(api).sort()` assertions
- [ ] Module-scoped `declare var localStorage`/`sessionStorage` in `session/src/snapshot.ts` (in-page evaluate callback typing)
- [ ] `session` is class-based per spec §4 conv 4; `network` is function-first
- [ ] No `vi.mock("puppeteer-core")` anywhere; all tests inject plain object mocks
- [ ] `network`'s `blockResources` is idempotent under repeat calls (verified by test)
- [ ] `THROTTLE_PROFILES` is `Object.freeze`-d (defensive immutability)
