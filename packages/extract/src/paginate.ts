import type { Page } from "puppeteer-core";
import { ConfigError, PptrKitError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface PaginateOptions<T> extends LoggerOption {
  /** CSS selector of the "next page" control. Its ABSENCE ends the loop (not an error). */
  nextSelector: string;
  /** Extractor run against `page` on each visited page; results are concatenated in order. */
  extractFn: (page: Page) => Promise<T[]>;
  /** Safety bound on pages visited. Default 50. Must be >= 1. */
  maxPages?: number;
  /** Wait (ms) after clicking "next" for new content to render. Default 500. */
  settleMs?: number;
}

/**
 * Extract across a paginated listing: run `extractFn` on the current page, click
 * `nextSelector`, wait `settleMs` for content to render, repeat until there is no
 * next control (`page.$` returns null — the exhaustion signal) or `maxPages` is
 * reached. Aggregates every page's results in visit order.
 *
 * A missing next control is deliberately NOT a `SelectorNotFoundError` — it is how
 * the loop terminates, consistent with this package's tolerant contract. `maxPages < 1`
 * is caller misuse (`ConfigError`); a click rejection is wrapped as a retryable
 * `PptrKitError`.
 */
export async function extractPaginated<T>(
  page: Page,
  options: PaginateOptions<T>,
): Promise<T[]> {
  const { nextSelector, extractFn, logger } = options;
  const maxPages = options.maxPages ?? 50;
  const settleMs = options.settleMs ?? 500;

  if (maxPages < 1) {
    throw new ConfigError(
      `extractPaginated: maxPages must be >= 1 (got ${maxPages})`,
      { context: { maxPages } },
    );
  }

  const results: T[] = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    logger?.log(`extractPaginated: extracting page ${pageNum}`, "step");
    const pageResults = await extractFn(page);
    results.push(...pageResults);

    if (pageNum === maxPages) {
      logger?.log(`extractPaginated: reached maxPages (${maxPages})`, "step");
      break;
    }

    const next = await page.$(nextSelector);
    if (next === null) {
      logger?.log("extractPaginated: no next control — exhausted", "success");
      break;
    }

    try {
      await next.click();
    } catch (cause) {
      throw new PptrKitError("extractPaginated: click on next control failed", {
        retryable: true,
        cause,
        context: { nextSelector, page: pageNum },
      });
    } finally {
      await next.dispose();
    }

    if (settleMs > 0) await sleep(settleMs);
  }

  logger?.log(`extractPaginated: collected ${results.length} item(s)`, "success");
  return results;
}
