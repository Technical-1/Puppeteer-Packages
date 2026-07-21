# @technical-1/coverage

JS + CSS coverage collection for a Puppeteer `Page` — bracket an interaction with
`page.coverage`, and get per-file used/unused byte ranges plus rolled-up summaries. You
inject the `Page` (type-only `puppeteer-core` peer). Errors are typed `PptrKitError` /
`ConfigError` from `@technical-1/core`; pass an optional DI `logger`.

```ts
import { collectCoverage } from "@technical-1/coverage";

const { total, files } = await collectCoverage(page, async (p) => {
  await p.goto("https://example.com", { waitUntil: "networkidle0" });
  await p.click("#load-more");
});

console.log(`${Math.round(total.usedRatio * 100)}% of shipped bytes were used`);
for (const f of files.filter((f) => f.unusedBytes > 10_000)) {
  console.log(`${f.url}: ${f.unusedBytes} unused bytes (${f.type})`);
}
```

## Behavior

`collectCoverage(page, fn, options?)` starts `page.coverage` (JS and/or CSS), runs `fn`,
and stops coverage — returning `fn`'s result alongside the collected data. Stopping is
**guaranteed via `finally`**: if `fn` throws, coverage is still stopped (best-effort) before
the caller's error propagates, so a failed interaction never leaves collection running.

### `CollectCoverageOptions`

| Option                     | Default | Notes                                                          |
| --------------------------- | ------- | ---------------------------------------------------------------- |
| `js`                        | `true`  | Collect JS coverage.                                              |
| `css`                       | `true`  | Collect CSS coverage.                                             |
| `resetOnNavigation`         | `false` | **Deviates from puppeteer-core's own default of `true`** — a `page.goto` inside `fn` does not wipe the window's data. |
| `reportAnonymousScripts`    | —       | JS-only passthrough to `startJSCoverage`.                        |
| `includeRawScriptCoverage`  | —       | JS-only passthrough to `startJSCoverage`.                        |
| `useBlockCoverage`          | —       | JS-only passthrough to `startJSCoverage`.                        |
| `logger`                    | —       | Optional DI logger; receives `step`/`success` progress messages. |

At least one of `js` / `css` must be enabled — passing both `false` throws a non-retryable
`ConfigError`.

### `CoverageResult<T>`

```ts
interface CoverageResult<T> {
  result: T; // fn's return value
  files: FileCoverage[]; // per-file used/unused ranges, one entry per JS or CSS resource
  js: CoverageSummary; // rolled-up totals across js files only
  css: CoverageSummary; // rolled-up totals across css files only
  total: CoverageSummary; // rolled-up totals across all files
}
```

A `CoverageSummary` is `{ totalBytes, usedBytes, unusedBytes, usedRatio }`, where
`usedRatio` is `usedBytes / totalBytes` (`0` when there are no bytes). A `FileCoverage`
adds `url`, `type` (`"js" | "css"`), and the `usedRanges` / `unusedRanges` themselves.

Byte counts are computed as `end - start` over each range — puppeteer-core's own
`CoverageEntry.ranges` type marks `end` as `-1` in its README example, but the CDP data
this package consumes always reports real byte offsets, so no `-1` special-casing is
needed here.

## Errors

- **`ConfigError`** (`retryable: false`) — misuse: both `js` and `css` disabled.
- **`PptrKitError`** (`retryable: true`) — the underlying `startJSCoverage` /
  `startCSSCoverage` / `stopJSCoverage` / `stopCSSCoverage` call rejected; the original
  error is attached as `cause`.
- Errors thrown by the caller's own `fn` are **re-thrown unwrapped** — `collectCoverage`
  never masks or wraps them, it just guarantees coverage is stopped first.

## Install

```sh
pnpm add @technical-1/coverage puppeteer-core
```

`puppeteer-core` is a **type-only** peer dependency (`>=22 <25`) — it supplies the `Page`
type used at compile time; this package never imports it at runtime.
