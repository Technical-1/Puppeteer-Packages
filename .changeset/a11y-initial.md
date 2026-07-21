---
"@technical-1/a11y": minor
---

New package: accessibility (AX) tree snapshot + query helpers. `snapshotAccessibility(page, options?)`
wraps `page.accessibility.snapshot()` with a DI logger, `SnapshotOptions` passthrough, and a typed
`PptrKitError` on failure; `findByRole(tree, role)` and `findByName(tree, name)` are pure pre-order
queries over the returned tree.
