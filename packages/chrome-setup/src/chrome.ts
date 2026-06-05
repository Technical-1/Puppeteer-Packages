// Note: @puppeteer/browsers has no "types" export condition; its types resolve
// via the .d.ts co-located with the NodeNext-resolved .js. Works with the
// current upstream layout.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Browser, detectBrowserPlatform, install, resolveBuildId } from "@puppeteer/browsers";
import { PptrKitError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";

/** Pinned Chrome-for-Testing build used when downloading. */
export const DEFAULT_CHROME_BUILD = "144.0.7559.96";

/** Node platform identifier (e.g. "darwin", "linux", "win32"). */
export type PlatformName = NodeJS.Platform;

function executableNames(platform: PlatformName): string[] {
  if (platform === "win32") return ["chrome.exe"];
  if (platform === "darwin")
    return ["Google Chrome for Testing", "Chromium", "Google Chrome"];
  return ["chrome", "chromium"];
}

/** BFS a directory tree for a Chrome executable; descends macOS .app bundles. */
function findChromeExecutable(baseDir: string, platform: PlatformName): string | undefined {
  if (!existsSync(baseDir)) return undefined;
  const names = executableNames(platform);
  const queue: string[] = [baseDir];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".app")) {
          const macOS = join(full, "Contents", "MacOS");
          if (existsSync(macOS)) queue.unshift(macOS);
        } else {
          queue.push(full);
        }
      } else if (names.includes(entry.name)) {
        return full;
      }
    }
  }
  return undefined;
}

export interface ResolveChromeOptions {
  /** Directories to search (recursively). Default: `<cwd>/chrome-local`, the
   *  Puppeteer cache (`~/.cache/puppeteer`). */
  searchDirs?: string[];
  /**
   * Override the platform used for executable-NAME matching during
   * resolution (tests / cross-checking). Default: `process.platform`. This
   * does NOT affect `downloadChrome`, which always downloads for the current
   * machine via `@puppeteer/browsers` `detectBrowserPlatform()`.
   */
  platform?: PlatformName;
}

function defaultSearchDirs(): string[] {
  return [join(process.cwd(), "chrome-local"), join(homedir(), ".cache", "puppeteer")];
}

/** Resolve an existing Chrome executable path, or `undefined`. Pure/sync. */
export function resolveChromePath(opts: ResolveChromeOptions = {}): string | undefined {
  const platform = opts.platform ?? (process.platform as PlatformName);
  const dirs = opts.searchDirs ?? defaultSearchDirs();
  for (const dir of dirs) {
    const found = findChromeExecutable(dir, platform);
    if (found) return found;
  }
  return undefined;
}

/**
 * Pick the build to install: an explicit `buildId` pins it (reproducible);
 * otherwise resolve the latest stable Chrome. If stable resolution fails
 * (offline / resolver error) fall back to the pinned DEFAULT_CHROME_BUILD
 * rather than throwing.
 */
async function selectBuildId(
  platform: NonNullable<ReturnType<typeof detectBrowserPlatform>>,
  explicit: string | undefined,
  logger: LoggerOption["logger"],
): Promise<string> {
  if (explicit) return explicit;
  try {
    const id = await resolveBuildId(Browser.CHROME, platform, "stable");
    logger?.log(`Resolved latest stable Chrome ${id}`, "step");
    return id;
  } catch {
    logger?.log(
      `Stable Chrome resolution failed; using pinned ${DEFAULT_CHROME_BUILD}`,
      "step",
    );
    return DEFAULT_CHROME_BUILD;
  }
}

export interface DownloadChromeOptions extends LoggerOption {
  /** Chrome build id. Default: the latest stable Chrome, resolved at install
   *  time. Pass an explicit version (e.g. DEFAULT_CHROME_BUILD) to pin a
   *  reproducible build. */
  buildId?: string;
  /** Cache directory to install into. Default: `~/.cache/puppeteer`. */
  cacheDir?: string;
}

/** Download a Chrome build via `@puppeteer/browsers`. */
export async function downloadChrome(
  opts: DownloadChromeOptions = {},
): Promise<{ executablePath: string }> {
  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new PptrKitError("Could not detect a browser platform for download", {
      context: { phase: "detectBrowserPlatform" },
    });
  }
  const buildId = await selectBuildId(platform, opts.buildId, opts.logger);
  const cacheDir = opts.cacheDir ?? join(homedir(), ".cache", "puppeteer");
  opts.logger?.log(`Downloading Chrome ${buildId} (${platform})`, "step");
  let installed;
  try {
    installed = await install({ browser: Browser.CHROME, buildId, cacheDir, platform });
  } catch (err) {
    throw new PptrKitError(`Chrome download failed (${buildId}, ${platform})`, {
      cause: err,
      retryable: true,
      context: { buildId, platform },
    });
  }
  opts.logger?.log(`Chrome ready at ${installed.executablePath}`, "success");
  return { executablePath: installed.executablePath };
}

export type EnsureChromeOptions = ResolveChromeOptions & DownloadChromeOptions;

/** Resolve an existing Chrome; otherwise download one. Throws on failure. */
export async function ensureChrome(opts: EnsureChromeOptions = {}): Promise<string> {
  const existing = resolveChromePath(opts);
  if (existing) {
    opts.logger?.log(`Using resolved Chrome at ${existing}`, "info");
    return existing;
  }
  const { executablePath } = await downloadChrome(opts);
  if (!executablePath) {
    throw new PptrKitError("Chrome could not be resolved or downloaded", {
      context: { searchDirs: opts.searchDirs ?? defaultSearchDirs() },
    });
  }
  return executablePath;
}
