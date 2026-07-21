import type { Page } from "puppeteer-core";

// Minimal browser-global declarations for in-page evaluate callbacks (roadmap
// convention). Module-scoped; NOT the DOM lib, NOT @types. Declare only what
// the callbacks below use.
interface InPageRoot {
  querySelector(s: string): InPageElement | null;
  querySelectorAll(s: string): Iterable<InPageElement>;
}
interface InPageElement {
  textContent: string | null;
  shadowRoot: InPageRoot | null;
  querySelector(s: string): InPageElement | null;
  querySelectorAll(s: string): Iterable<InPageElement>;
}
declare var document: InPageRoot;

export interface ExtractOptions {
  /** Traverse OPEN shadow roots when resolving the selector. Default false. */
  pierceShadow?: boolean;
}

/** Trimmed textContent of the first match; "" if absent OR textContent is null/empty. */
export async function extractText(
  page: Page,
  selector: string,
  options: ExtractOptions = {},
): Promise<string> {
  const pierce = options.pierceShadow ?? false;
  const text = await page.evaluate(
    (sel: string, deep: boolean) => {
      function deepFirst(root: InPageRoot, s: string): InPageElement | null {
        const direct = root.querySelector(s);
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (el.shadowRoot) {
            const found = deepFirst(el.shadowRoot, s);
            if (found) return found;
          }
        }
        return null;
      }
      const el = deep ? deepFirst(document, sel) : document.querySelector(sel);
      return el && el.textContent ? el.textContent : "";
    },
    selector,
    pierce,
  );
  return text.trim();
}

/** Trimmed textContent of every match (empty array if none). Optionally pierces open shadow roots. */
export async function extractAll(
  page: Page,
  selector: string,
  options: ExtractOptions = {},
): Promise<string[]> {
  const pierce = options.pierceShadow ?? false;
  const texts = await page.evaluate(
    (sel: string, deep: boolean) => {
      function deepAll(root: InPageRoot, s: string, out: InPageElement[]): void {
        for (const el of Array.from(root.querySelectorAll(s))) out.push(el);
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (el.shadowRoot) deepAll(el.shadowRoot, s, out);
        }
      }
      let nodes: InPageElement[];
      if (deep) {
        nodes = [];
        deepAll(document, sel, nodes);
      } else {
        nodes = Array.from(document.querySelectorAll(sel));
      }
      return nodes.map((el) => (el.textContent ? el.textContent : ""));
    },
    selector,
    pierce,
  );
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
