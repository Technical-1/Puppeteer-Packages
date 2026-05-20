import { PptrKitError } from "@technical-1/core";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Stats } from "node:fs";
import type { AwaitDownloadOptions, DownloadResult } from "./types.js";

/** Options including the test-injectable filesystem hooks (omitted from the public surface). */
interface InternalOptions extends AwaitDownloadOptions {
  readdir?: (dir: string) => Promise<string[]>;
  stat?: (path: string) => Promise<Stats>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Snapshot `dir`, invoke `triggerFn`, and poll the directory until a new
 * non-`.crdownload` file appears. Returns `{path, filename, size}`.
 *
 * Throws `PptrKitError` (`retryable:true`) on timeout (default 30s).
 *
 * The `readdir`/`stat` overrides are for unit testing; production callers
 * leave them undefined.
 */
export async function awaitDownload(
  dir: string,
  triggerFn: () => Promise<void> | void,
  opts: InternalOptions = {},
): Promise<DownloadResult> {
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const _readdir = opts.readdir ?? readdir;
  const _stat = opts.stat ?? stat;

  let before: Set<string>;
  try {
    before = new Set(await _readdir(dir));
  } catch (cause) {
    throw new PptrKitError("awaitDownload: failed to snapshot directory", { retryable: false, cause });
  }

  try {
    await triggerFn();
  } catch (cause) {
    throw new PptrKitError("awaitDownload: trigger threw", { retryable: false, cause });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const now = await _readdir(dir);
    for (const name of now) {
      if (before.has(name)) continue;
      if (name.endsWith(".crdownload")) continue; // still downloading
      const path = join(dir, name);
      const s = await _stat(path);
      return { path, filename: name, size: s.size };
    }
    await sleep(pollMs);
  }

  throw new PptrKitError(`awaitDownload: no new file in ${dir} within ${timeoutMs}ms`, {
    retryable: true,
    context: { dir, timeoutMs },
  });
}
