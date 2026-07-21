# @technical-1/contexts

Isolated `BrowserContext` lifecycle for Puppeteer — create/close incognito contexts with guaranteed cleanup, per-context proxy, permission overrides, and typed target enumeration.

> **Convenience wrapper.** This package wraps puppeteer-core's `Browser.createBrowserContext` and `BrowserContext` methods (`close`, `targets`, `overridePermissions`, `clearPermissionOverrides`) with typed errors (`ContextError` from `@technical-1/core`), guaranteed finally-cleanup, and a DI logger. It adds no capability beyond the raw APIs — it exists so a leaked incognito context or an unanswered permission-grant failure never silently corrupts a suite-driven flow.

```ts
import { withContext, createIsolatedContext } from "@technical-1/contexts";

// Preferred: guaranteed cleanup, even if fn throws.
await withContext(browser, async (ctx) => {
  const page = await ctx.newPage();
  await page.goto("https://example.com");
  // ... do work with page ...
});

// Manual lifecycle, when you need the context to outlive one callback:
const ctx = await createIsolatedContext(browser);
try {
  const page = await ctx.newPage();
  await page.goto("https://example.com");
} finally {
  await ctx.close();
}

// Per-context proxy (no second Chrome process needed):
await withContext(browser, async (ctx) => {
  const page = await ctx.newPage();
  await page.goto("https://example.com");
}, {
  proxyServer: "http://proxy.example.com:8080",
  proxyBypassList: ["localhost"],
});

// Permission grants applied immediately after the context is created:
await withContext(browser, async (ctx) => {
  const page = await ctx.newPage();
  await page.goto("https://example.com");
}, {
  permissions: [
    { origin: "https://example.com", permissions: ["geolocation", "notifications"] },
  ],
});
```

## `listContextTargets`

Enumerate a context's targets as flat, typed rows — synchronous, mirrors puppeteer-core's synchronous `BrowserContext.targets()`:

```ts
import { listContextTargets } from "@technical-1/contexts";

const targets = listContextTargets(ctx);
// [{ type: "page", url: "https://example.com" }, ...]
```

## Isolation note

Each context created by `createIsolatedContext` / `withContext` has isolated cookies, localStorage, and session storage — a fresh incognito-style profile. This is the fix for `@technical-1/session`'s shared-context cross-account bleed: give one account one context, and its cookies and login state can never leak into another account's session running in the same browser.

## Proxy note

`proxyServer` (and `proxyBypassList`) is applied per-context at creation time, so you can route different contexts through different proxies inside a single Chrome process — no need to launch a second browser per proxy. Proxy **credentials** still go through `Page.authenticate` on the pages you open in that context (see `@technical-1/proxy`); this package only sets the proxy address.

## `puppeteer-core` note

`puppeteer-core` is a peerDependency (`>=22 <25`) and is imported **type-only** in this package — there is no runtime value import. You bring your own `puppeteer-core` install; this package only uses its types.

## v1 limitations

- The **default context** (the one puppeteer-core creates automatically) cannot be closed — puppeteer-core throws if you try. `createIsolatedContext` / `withContext` always create a fresh, closable context.
- `overridePermissions` is **full-replace per origin**: any permission not listed is auto-denied by Chrome. For per-permission granted/denied/prompt state, use puppeteer-core's `BrowserContext.setPermission` directly.
- `newPage` is intentionally **not** wrapped — call `context.newPage()` directly on the `BrowserContext` you get back from `createIsolatedContext` / `withContext`.

## Errors

All thrown failures are `ContextError` from `@technical-1/core` (`retryable: true` for the underlying CDP/browser calls this package wraps), discriminated by `err.name === "ContextError"`. `createIsolatedContext` self-cleans (closes the just-created context) if a permission grant fails, so no orphan context leaks; `withContext` guarantees the context is closed in a `finally`-equivalent path, and a close failure is only logged — it never masks the original result or error.

## Install

```sh
pnpm add @technical-1/contexts puppeteer-core
```

`puppeteer-core` is a peer dependency (`>=22 <25`); bring your own.
