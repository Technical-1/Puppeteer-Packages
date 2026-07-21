# @technical-1/a11y

## 1.1.0

### Minor Changes

- bf16a47: New package: accessibility (AX) tree snapshot + query helpers. `snapshotAccessibility(page, options?)`
  wraps `page.accessibility.snapshot()` with a DI logger, `SnapshotOptions` passthrough, and a typed
  `PptrKitError` on failure; `findByRole(tree, role)` and `findByName(tree, name)` are pure pre-order
  queries over the returned tree.

### Patch Changes

- Updated dependencies [c1b1c0c]
- Updated dependencies [122c871]
- Updated dependencies [34f2973]
  - @technical-1/core@1.1.0
