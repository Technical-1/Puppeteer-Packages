import { DownloadError, TimeoutError } from "@technical-1/core";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Stats } from "node:fs";
import type { AwaitDownloadOptions, DownloadResult } from "./types.js";

/**
 * Test-only options including the filesystem hooks. NOT exported from the
 * barrel, NOT part of the public type surface — tests import this type
 * directly from `./await.js` and pass a wider opts via the
 * `awaitDownloadForTesting` shim below.
 */
export interface InternalAwaitDownloadOptions extends AwaitDownloadOptions {
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
 * Throws `TimeoutError` (`retryable:true`) on timeout (default 30s).
 *
 * The public surface accepts only `timeoutMs` / `pollMs`. The
 * `readdir`/`stat` injection seams used by unit tests are kept off the
 * public type via the un-barreled `awaitDownloadForTesting` shim below.
 */
export async function awaitDownload(
  dir: string,
  triggerFn: () => Promise<void> | void,
  opts: AwaitDownloadOptions = {},
): Promise<DownloadResult> {
  return awaitDownloadForTesting(dir, triggerFn, opts);
}

/**
 * Internal implementation that accepts the wider `InternalAwaitDownloadOptions`
 * (including `readdir`/`stat` overrides). Exported for unit tests only; NOT
 * re-exported by the package barrel. Production consumers should call
 * `awaitDownload` instead.
 *
 * @internal
 */
export async function awaitDownloadForTesting(
  dir: string,
  triggerFn: () => Promise<void> | void,
  opts: InternalAwaitDownloadOptions = {},
): Promise<DownloadResult> {
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const _readdir = opts.readdir ?? readdir;
  const _stat = opts.stat ?? stat;

  let before: Set<string>;
  try {
    before = new Set(await _readdir(dir));
  } catch (cause) {
    throw new DownloadError("awaitDownload: failed to snapshot directory", { retryable: false, cause });
  }

  try {
    await triggerFn();
  } catch (cause) {
    throw new DownloadError("awaitDownload: trigger threw", { retryable: false, cause });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const now = await _readdir(dir);
      for (const name of now) {
        if (before.has(name)) continue;
        if (name.endsWith(".crdownload")) continue; // still downloading
        const path = join(dir, name);
        const s = await _stat(path);
        return { path, filename: name, size: s.size };
      }
    } catch (cause) {
      // A mid-poll fs failure — dir removed, or a file vanished between the
      // readdir listing and the stat (a real .crdownload→final rename race).
      // Transient => retryable:true, and it MUST stay inside the DownloadError
      // contract rather than leaking a raw Node error to the caller.
      throw new DownloadError("awaitDownload: directory read failed during polling", {
        retryable: true,
        cause,
        context: { dir },
      });
    }
    await sleep(pollMs);
  }

  throw new TimeoutError(`awaitDownload: no new file in ${dir} within ${timeoutMs}ms`, {
    retryable: true,
    context: { dir, timeoutMs },
  });
}
