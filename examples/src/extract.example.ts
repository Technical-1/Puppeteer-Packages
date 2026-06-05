/**
 * @technical-1/extract — extractText / extractAll / extractTable / extractSchema demo
 *
 * Demonstrates structured data extraction from a page (text, node lists,
 * tables, and schema-mapped fields). Injected `Page` pattern — typecheck-only,
 * not executed in CI.
 */

import {
  extractText,
  extractAll,
  extractTable,
  extractSchema,
} from "@technical-1/extract";
import type { ExtractSchema } from "@technical-1/extract";
import type { Page } from "puppeteer-core";

export async function demo(page: Page): Promise<void> {
  // ── Single element text ───────────────────────────────────────────────────
  const heading = await extractText(page, "h1");
  console.log("heading:", heading);
  // => "Welcome to Example Domain"

  // ── All matching elements ─────────────────────────────────────────────────
  const links = await extractAll(page, "nav a");
  console.log("nav links:", links);
  // => ["Home", "Products", "About"]

  // ── Table rows × cells ────────────────────────────────────────────────────
  const rows = await extractTable(page, "table#results");
  console.log("table rows:", rows.length);
  // => 3
  console.log("first row:", rows[0]);
  // => ["Name", "Price", "Stock"]

  // ── Schema-mapped extraction ──────────────────────────────────────────────
  const schema: ExtractSchema = {
    title: "h1",
    description: "p.description",
    price: "span.price",
  };

  // extractSchema returns Record<string, string>; with noUncheckedIndexedAccess
  // each lookup is string | undefined — guard with ?? to model the absent case.
  const fields = await extractSchema(page, schema);
  console.log("title:", fields["title"] ?? "(not found)");
  console.log("price:", fields["price"] ?? "(not found)");
}
