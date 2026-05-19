import type { Page } from "puppeteer-core";

// Minimal browser-global declarations for in-page evaluate callbacks (roadmap
// convention). Module-scoped; NOT the DOM lib, NOT @types. Declare only what
// the callbacks below use.
interface InPageElement {
  textContent: string | null;
  querySelectorAll(s: string): Iterable<InPageElement>;
}
declare var document: {
  querySelector(s: string): InPageElement | null;
  querySelectorAll(s: string): Iterable<InPageElement>;
};

/** Trimmed textContent of the first match; "" if absent OR textContent is null/empty. */
export async function extractText(page: Page, selector: string): Promise<string> {
  const text = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    return el && el.textContent ? el.textContent : "";
  }, selector);
  return text.trim();
}

/** Trimmed textContent of every match (empty array if none). */
export async function extractAll(page: Page, selector: string): Promise<string[]> {
  const texts = await page.evaluate((sel: string) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    return nodes.map((el) => (el.textContent ? el.textContent : ""));
  }, selector);
  return texts.map((t) => t.trim());
}

/**
 * Rows × cells of trimmed text from the first matching table. `[]` if absent.
 *
 * v1 limitation: uses `querySelectorAll("tr")`, which also matches rows of any
 * nested `<table>` inside a cell (and that cell's text concatenates nested
 * text). Defined behavior for FLAT tables only; nested-table results are
 * undefined in v1.
 */
export async function extractTable(
  page: Page,
  selector: string,
): Promise<string[][]> {
  return page.evaluate((sel: string) => {
    const table = document.querySelector(sel);
    if (!table) return [] as string[][];
    const rows = Array.from(table.querySelectorAll("tr"));
    return rows.map((row) =>
      Array.from(row.querySelectorAll("td, th")).map((cell) =>
        (cell.textContent ? cell.textContent : "").trim(),
      ),
    );
  }, selector);
}

export type ExtractSchema = Record<string, string>;

/**
 * Map each field's selector to its trimmed text ("" when the node is absent).
 * Performs N sequential `extractText` (one `page.evaluate` round-trip per
 * field); batch via a single `page.evaluate` if a large schema is perf-critical.
 */
export async function extractSchema(
  page: Page,
  schema: ExtractSchema,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(schema)) {
    const selector = schema[key];
    if (selector === undefined) continue;
    out[key] = await extractText(page, selector);
  }
  return out;
}
