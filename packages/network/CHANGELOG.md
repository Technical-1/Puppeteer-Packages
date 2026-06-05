# @technical-1/network

## 0.1.0

### Minor Changes

- 54edf58: State & traffic tier: `session` (cookie + localStorage + sessionStorage
  snapshots with a label-keyed `Session` class store) and `network`
  (`blockResources`/`unblockResources` request blocking, `captureResponses`
  mutable response collector, `throttle`/`setOffline` + `THROTTLE_PROFILES`
  CDP network emulation). Both declare `@technical-1/core` as a dependency
  and `puppeteer-core` `>=22 <25` as a peer. `session` throws `SessionError`
  (terminal); `network` wraps externals in `PptrKitError` with explicit
  `retryable` (`true` for transient CDP failures, `false` for programmer
  errors like empty pattern lists).

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
