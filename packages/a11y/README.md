# @technical-1/a11y

Accessibility (AX) tree snapshots and role/name query helpers for a Puppeteer `Page`.
You inject the `Page` (type-only `puppeteer-core` peer). The snapshot delegates to
`page.accessibility.snapshot()`; the query helpers are pure functions over the returned
tree. Errors are typed `PptrKitError` / `ConfigError` from `@technical-1/core`; pass an
optional DI `logger`.

> **Convenience wrapper.** Adds no capability beyond puppeteer-core's
> `page.accessibility.snapshot()` — it exists to give the snapshot a typed error surface
> and DI logger, and to make role/name assertions ergonomic through one consistent surface.

```ts
import { snapshotAccessibility, findByRole, findByName } from "@technical-1/a11y";

const tree = await snapshotAccessibility(page);            // SerializedAXNode | null
const buttons = findByRole(tree, "button");                // every button node
const [saveBtn] = findByName(tree, "Save");                // nodes named exactly "Save"

// Full (un-pruned) tree, including iframe subtrees:
const full = await snapshotAccessibility(page, { interestingOnly: false, includeIframes: true });
```

## Behavior

- `snapshotAccessibility(page, options?)` → `SerializedAXNode | null`. `options` extends
  puppeteer's `SnapshotOptions` (`interestingOnly` default `true`, `includeIframes` default
  `false`, `root`) plus an optional DI `logger`. A `snapshot()` rejection is wrapped as
  `PptrKitError` (`retryable: true`) carrying the original as `cause`.
- `findByRole(tree, role)` / `findByName(tree, name)` → pre-order depth-first arrays of all
  matching nodes. `tree` may be `null` (returns `[]`). Matching is exact string equality.
  An empty/whitespace `role`/`name` throws `ConfigError` (`retryable: false`).

## Scope (v1.x)

AX snapshot + role/name lookup only. Not in scope: an axe-core-style rules/violations
engine, tree diffing, or JS/CSS coverage (a separate gap). The AX types come from
`puppeteer-core` and this package never touches CDP directly.

## Install

```sh
pnpm add @technical-1/a11y puppeteer-core
```

`puppeteer-core` is a peer dependency (`>=22 <25`); bring your own.
