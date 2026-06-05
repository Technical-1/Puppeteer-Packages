# @technical-1/logger

Concrete implementations of the `Logger` interface from `@technical-1/core`.
Packages never import this directly — the consumer injects an instance.

- `createConsoleLogger({ minLevel? })` — writes to the appropriate `console`
  method per level, filtering anything below `minLevel`.
- `createEventLogger()` → `EventLogger` (extends Node `EventEmitter`) — emits a
  `"log"` event `{ message, level }`; this is what lets the Electron template
  stream package log lines into its UI panel without any package knowing
  Electron exists.

**Default level:** `Logger.log(message, level?)` leaves `level` optional. This
package defines the default: when `level` is omitted it is treated as
`"info"`. (The `@technical-1/core` interface deliberately imposes no default.)

```ts
import { createConsoleLogger, createEventLogger } from "@technical-1/logger";
```

## Requirements

This package's emitted TypeScript definitions reference Node's built-in types
(`EventEmitter` from `node:events`). Your consumer project must have
`@types/node` installed as a devDependency:

```bash
npm install --save-dev @types/node
# or: pnpm add -D @types/node
```
