import { PptrKitError, ConfigError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";
import type {
  Page,
  CoverageEntry,
  JSCoverageEntry,
  JSCoverageOptions,
  CSSCoverageOptions,
} from "puppeteer-core";
import { fileCoverageOf, summarize } from "./summary.js";
import type { CoverageSummary, FileCoverage } from "./summary.js";

/**
 * Options for {@link collectCoverage}.
 *
 * `js`/`css` gate which domains are collected (default: both). `resetOnNavigation`
 * defaults to **`false`** (deviating from puppeteer-core's `true`) so a `page.goto`
 * inside `fn` does not wipe the window's data. The remaining fields are JS-only
 * passthroughs to `startJSCoverage`.
 */
export interface CollectCoverageOptions extends LoggerOption {
  js?: boolean;
  css?: boolean;
  resetOnNavigation?: boolean;
  reportAnonymousScripts?: boolean;
  includeRawScriptCoverage?: boolean;
  useBlockCoverage?: boolean;
}

/** The value returned by {@link collectCoverage}: the fn's result plus coverage data. */
export interface CoverageResult<T> {
  result: T;
  files: FileCoverage[];
  js: CoverageSummary;
  css: CoverageSummary;
  total: CoverageSummary;
}

interface StoppedEntries {
  jsEntries: JSCoverageEntry[];
  cssEntries: CoverageEntry[];
}

/** Stop enabled domains, wrapping any rejection as a retryable PptrKitError. */
async function stopCoverage(page: Page, js: boolean, css: boolean): Promise<StoppedEntries> {
  try {
    const [jsEntries, cssEntries] = await Promise.all([
      js ? page.coverage.stopJSCoverage() : Promise.resolve<JSCoverageEntry[]>([]),
      css ? page.coverage.stopCSSCoverage() : Promise.resolve<CoverageEntry[]>([]),
    ]);
    return { jsEntries, cssEntries };
  } catch (cause) {
    throw new PptrKitError("collectCoverage: failed to stop coverage", {
      retryable: true,
      cause,
      context: { js, css },
    });
  }
}

/** Best-effort teardown used only when `fn` (or the primary stop) already threw. */
async function stopCoverageQuiet(page: Page, js: boolean, css: boolean): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (js) tasks.push(Promise.resolve(page.coverage.stopJSCoverage()).catch(() => undefined));
  if (css) tasks.push(Promise.resolve(page.coverage.stopCSSCoverage()).catch(() => undefined));
  await Promise.all(tasks);
}

export async function collectCoverage<T>(
  page: Page,
  fn: (page: Page) => Promise<T> | T,
  options: CollectCoverageOptions = {},
): Promise<CoverageResult<T>> {
  const {
    js = true,
    css = true,
    resetOnNavigation = false,
    reportAnonymousScripts,
    includeRawScriptCoverage,
    useBlockCoverage,
    logger,
  } = options;

  if (!js && !css) {
    throw new ConfigError("collectCoverage: enable at least one of `js` or `css`", {
      context: { js, css },
    });
  }

  const jsStartOptions: JSCoverageOptions = {
    resetOnNavigation,
    reportAnonymousScripts,
    includeRawScriptCoverage,
    useBlockCoverage,
  };
  const cssStartOptions: CSSCoverageOptions = { resetOnNavigation };

  logger?.log(`starting coverage (${[js && "js", css && "css"].filter(Boolean).join(", ")})`, "step");
  try {
    await Promise.all([
      js ? page.coverage.startJSCoverage(jsStartOptions) : undefined,
      css ? page.coverage.startCSSCoverage(cssStartOptions) : undefined,
    ]);
  } catch (cause) {
    throw new PptrKitError("collectCoverage: failed to start coverage", {
      retryable: true,
      cause,
      context: { js, css },
    });
  }

  let stopped = false;
  try {
    const result = await fn(page);
    const { jsEntries, cssEntries } = await stopCoverage(page, js, css);
    stopped = true;

    const files: FileCoverage[] = [
      ...jsEntries.map((e) => fileCoverageOf(e, "js")),
      ...cssEntries.map((e) => fileCoverageOf(e, "css")),
    ];
    const total = summarize(files);
    logger?.log(
      `coverage collected: ${Math.round(total.usedRatio * 100)}% used (${total.usedBytes}/${total.totalBytes} bytes)`,
      "success",
    );
    return { result, files, js: summarize(files, "js"), css: summarize(files, "css"), total };
  } finally {
    if (!stopped) await stopCoverageQuiet(page, js, css);
  }
}
