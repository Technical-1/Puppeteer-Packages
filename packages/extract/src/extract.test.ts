import { describe, it, expect, vi } from "vitest";
import {
  extractText,
  extractAll,
  extractTable,
  extractSchema,
} from "./extract.js";
import type { Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    evaluate: vi.fn(),
    ...overrides,
  } as unknown as Page;
}

// ---------------------------------------------------------------------------
// Helpers for testing the in-page evaluate callback bodies (lines 18-19,
// 27-28, 46-53 of extract.ts). The mocks above bypass the callback entirely;
// here we capture the function reference that gets passed to page.evaluate
// and invoke it directly with a fake `document` global.
// ---------------------------------------------------------------------------

/** Minimal in-page element shape used by the evaluate callbacks. */
interface FakeEl {
  textContent: string | null;
  shadowRoot: FakeDocument | null;
  querySelectorAll: (s: string) => Iterable<FakeEl>;
}

/** Create a fake InPageElement that behaves like a real DOM node. */
function fakeEl(textContent: string | null, children: FakeEl[] = []): FakeEl {
  return {
    textContent,
    shadowRoot: null,
    querySelectorAll: (_s: string) => children,
  };
}

type FakeDocument = {
  querySelector: (s: string) => FakeEl | null;
  querySelectorAll: (s: string) => Iterable<FakeEl>;
};

/**
 * Capture the callback that `page.evaluate` receives, then execute it with
 * a fake `document` global so v8 can instrument the callback body.
 */
function captureEvaluatePage(
  fakeDocument: FakeDocument,
  resolveWith: unknown,
): Page {
  let capturedFn: ((...args: unknown[]) => unknown) | undefined;
  let capturedArgs: unknown[] = [];
  return {
    evaluate: vi.fn().mockImplementation(
      async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
        capturedFn = fn;
        capturedArgs = args;
        // Temporarily install the fake document on globalThis so the callback body
        // can reference `document` as a global (matching the in-browser contract).
        const saved = (globalThis as Record<string, unknown>)["document"];
        (globalThis as Record<string, unknown>)["document"] = fakeDocument;
        try {
          return capturedFn(...capturedArgs);
        } finally {
          if (saved === undefined) {
            delete (globalThis as Record<string, unknown>)["document"];
          } else {
            (globalThis as Record<string, unknown>)["document"] = saved;
          }
        }
      },
    ),
    _resolveWith: resolveWith, // for reference; not used by evaluate mock
  } as unknown as Page;
}

describe("extractText", () => {
  it("returns trimmed text for a present selector", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("  hi  ") });
    expect(await extractText(page, "h1")).toBe("hi");
  });

  it("returns empty string when the selector is absent", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("") });
    expect(await extractText(page, "h1")).toBe("");
  });

  describe("in-page callback body (lines 18-19)", () => {
    it("callback returns textContent when element is found", async () => {
      const doc: FakeDocument = {
        querySelector: () => fakeEl("  Hello  "),
        querySelectorAll: () => [],
      };
      const page = captureEvaluatePage(doc, "  Hello  ");
      const result = await extractText(page, "h1");
      expect(result).toBe("Hello");
    });

    it("callback returns '' when element is absent (querySelector returns null)", async () => {
      const doc: FakeDocument = {
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      const page = captureEvaluatePage(doc, "");
      const result = await extractText(page, "h1");
      expect(result).toBe("");
    });

    it("callback returns '' when element has null textContent", async () => {
      const doc: FakeDocument = {
        querySelector: () => fakeEl(null),
        querySelectorAll: () => [],
      };
      const page = captureEvaluatePage(doc, "");
      const result = await extractText(page, "span");
      expect(result).toBe("");
    });
  });
});

describe("extractText pierceShadow", () => {
  it("does NOT pierce by default (deep=false path uses document.querySelector)", async () => {
    // direct match present; querySelectorAll('*') would throw if touched
    const doc: FakeDocument = {
      querySelector: (s) => (s === "span.deep" ? fakeEl("  top  ") : null),
      querySelectorAll: () => {
        throw new Error("must not enumerate when pierceShadow is false");
      },
    };
    const page = captureEvaluatePage(doc, "  top  ");
    expect(await extractText(page, "span.deep")).toBe("top");
  });

  it("pierces one open shadow root to find the target (deep=true recursion)", async () => {
    const target = fakeEl("  shadowed  ");
    const shadow: FakeDocument = {
      querySelector: (s) => (s === "span.deep" ? target : null),
      querySelectorAll: () => [],
    };
    const host = fakeEl(null);
    host.shadowRoot = shadow;
    const doc: FakeDocument = {
      querySelector: () => null, // no direct match at document
      querySelectorAll: (s) => (s === "*" ? [host] : []),
    };
    const page = captureEvaluatePage(doc, "  shadowed  ");
    expect(await extractText(page, "span.deep", { pierceShadow: true })).toBe(
      "shadowed",
    );
  });

  it("returns '' when pierceShadow finds nothing (no direct, no shadow host matches)", async () => {
    const plain = fakeEl("x"); // element with shadowRoot null → skipped by walker
    const doc: FakeDocument = {
      querySelector: () => null,
      querySelectorAll: (s) => (s === "*" ? [plain] : []),
    };
    const page = captureEvaluatePage(doc, "");
    expect(await extractText(page, "span.deep", { pierceShadow: true })).toBe(
      "",
    );
  });
});

describe("extractAll", () => {
  it("returns trimmed text of every match", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue([" a ", "b "]) });
    expect(await extractAll(page, ".x")).toEqual(["a", "b"]);
  });

  it("returns [] when nothing matches", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue([]) });
    expect(await extractAll(page, ".x")).toEqual([]);
  });

  describe("in-page callback body (lines 27-28)", () => {
    it("callback maps textContent of every matching node", async () => {
      const doc: FakeDocument = {
        querySelector: () => null,
        querySelectorAll: () => [fakeEl(" a "), fakeEl("b ")],
      };
      const page = captureEvaluatePage(doc, []);
      const result = await extractAll(page, ".x");
      // Callback returns raw strings (not trimmed); extractAll trims them.
      expect(result).toEqual(["a", "b"]);
    });

    it("callback falls back to '' when a node has null textContent (line 28 ternary false branch)", async () => {
      const doc: FakeDocument = {
        querySelector: () => null,
        querySelectorAll: () => [fakeEl("text"), fakeEl(null)],
      };
      const page = captureEvaluatePage(doc, []);
      const result = await extractAll(page, ".x");
      expect(result).toEqual(["text", ""]);
    });
  });
});

describe("extractAll pierceShadow", () => {
  it("collects matches across the top document AND open shadow roots", async () => {
    const shadowMatch = fakeEl(" inner ");
    const shadow: FakeDocument = {
      querySelector: () => null,
      querySelectorAll: (s) => (s === ".x" ? [shadowMatch] : []),
    };
    const host = fakeEl(null);
    host.shadowRoot = shadow;
    const topMatch = fakeEl(" outer ");
    const doc: FakeDocument = {
      querySelectorAll: (s) => {
        if (s === ".x") return [topMatch]; // top-level matches
        if (s === "*") return [host]; // shadow hosts to recurse into
        return [];
      },
      querySelector: () => null,
    };
    const page = captureEvaluatePage(doc, []);
    expect(await extractAll(page, ".x", { pierceShadow: true })).toEqual(["outer", "inner"]);
  });

  it("default (deep=false) does not enumerate shadow hosts", async () => {
    const doc: FakeDocument = {
      querySelector: () => null,
      querySelectorAll: (s) => (s === ".x" ? [fakeEl(" a ")] : (() => { throw new Error("no '*'"); })()),
    };
    const page = captureEvaluatePage(doc, []);
    expect(await extractAll(page, ".x")).toEqual(["a"]);
  });
});

describe("extractTable", () => {
  it("returns a 2D array of trimmed cell text", async () => {
    const page = mockPage({
      evaluate: vi.fn().mockResolvedValue([
        ["1", "2"],
        ["3", "4"],
      ]),
    });
    expect(await extractTable(page, "table")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("returns [] when the table/selector is absent (tolerant)", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue([]) });
    expect(await extractTable(page, "table#missing")).toEqual([]);
  });

  describe("in-page callback body (lines 46-53)", () => {
    it("callback returns [] when querySelector returns null (line 47 early return)", async () => {
      const doc: FakeDocument = {
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      const page = captureEvaluatePage(doc, []);
      const result = await extractTable(page, "table#missing");
      expect(result).toEqual([]);
    });

    it("callback maps rows × cells returning trimmed text strings (lines 48-52)", async () => {
      const td1 = fakeEl(" A ");
      const td2 = fakeEl(" B ");
      const tr1 = fakeEl("", [td1, td2]);
      // A table with one row, two cells.
      const table = fakeEl("", [tr1]);
      // Override querySelectorAll on the table element to return rows when "tr" is queried,
      // and on each row to return cells when "td, th" is queried.
      const tableEl = {
        textContent: "",
        querySelectorAll: (s: string) => (s === "tr" ? [tr1] : []),
      };
      const rowEl = {
        textContent: "",
        shadowRoot: null,
        querySelectorAll: (s: string) => (s === "td, th" ? [td1, td2] : []),
      };
      const tableElWithRow = {
        textContent: "",
        shadowRoot: null,
        querySelectorAll: (_s: string) => [rowEl],
      };
      const doc: FakeDocument = {
        querySelector: () => tableElWithRow,
        querySelectorAll: () => [],
      };
      const page = captureEvaluatePage(doc, []);
      const result = await extractTable(page, "table");
      expect(result).toEqual([["A", "B"]]);
    });

    it("callback falls back to '' when a cell has null textContent (line 51 ternary false branch)", async () => {
      const cellWithNull = fakeEl(null);
      const row = {
        textContent: "",
        shadowRoot: null,
        querySelectorAll: (_s: string) => [cellWithNull],
      };
      const tableElWithNullCell = {
        textContent: "",
        shadowRoot: null,
        querySelectorAll: (_s: string) => [row],
      };
      const doc: FakeDocument = {
        querySelector: () => tableElWithNullCell,
        querySelectorAll: () => [],
      };
      const page = captureEvaluatePage(doc, []);
      const result = await extractTable(page, "table");
      expect(result).toEqual([[""]]);
    });
  });

  describe("extractTable pierceShadow", () => {
    it("locates a table inside an open shadow root, then reads rows/cells", async () => {
      const cellA = fakeEl(" A ");
      const cellB = fakeEl(" B ");
      const rowEl = {
        textContent: "",
        shadowRoot: null,
        querySelector: () => null,
        querySelectorAll: (s: string) => (s === "td, th" ? [cellA, cellB] : []),
      };
      const tableEl = {
        textContent: "",
        shadowRoot: null,
        querySelector: () => null,
        querySelectorAll: (s: string) => (s === "tr" ? [rowEl] : []),
      };
      const shadow: FakeDocument = {
        querySelector: (s) => (s === "table" ? tableEl : null),
        querySelectorAll: () => [],
      };
      const host = fakeEl(null);
      host.shadowRoot = shadow;
      const doc: FakeDocument = {
        querySelector: () => null, // no table at top level
        querySelectorAll: (s) => (s === "*" ? [host] : []),
      };
      const page = captureEvaluatePage(doc, []);
      expect(await extractTable(page, "table", { pierceShadow: true })).toEqual([
        ["A", "B"],
      ]);
    });

    it("returns [] when pierceShadow cannot locate the table", async () => {
      const doc: FakeDocument = {
        querySelector: () => null,
        querySelectorAll: (s) => (s === "*" ? [] : []),
      };
      const page = captureEvaluatePage(doc, []);
      expect(
        await extractTable(page, "table#missing", { pierceShadow: true }),
      ).toEqual([]);
    });
  });
});

describe("extractSchema", () => {
  it("maps each field selector to its trimmed text ('' when absent)", async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce(" Widget ")
      .mockResolvedValueOnce("");
    const page = mockPage({ evaluate });
    const row = await extractSchema(page, { name: ".name", price: ".price" });
    expect(row).toEqual({ name: "Widget", price: "" });
  });

  it("returns {} for an empty schema with zero page round-trips", async () => {
    const evaluate = vi.fn();
    const page = mockPage({ evaluate });
    expect(await extractSchema(page, {})).toEqual({});
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("skips keys whose value is undefined (line 71 noUncheckedIndexedAccess guard)", async () => {
    // noUncheckedIndexedAccess types schema[key] as string | undefined.
    // In practice Object.keys() only returns present keys, but the guard on
    // line 71 protects against any runtime case where a value is undefined.
    // We trigger it by casting a sparse-value object as the schema type.
    const evaluate = vi.fn().mockResolvedValue("text");
    const page = mockPage({ evaluate });
    // Cast: the real key "missing" maps to undefined at runtime.
    const schema = { present: ".p", missing: undefined } as unknown as Record<string, string>;
    const result = await extractSchema(page, schema);
    // "present" is extracted; "missing" is skipped (undefined guard fires).
    expect(result).toEqual({ present: "text" });
    expect(evaluate).toHaveBeenCalledOnce();
  });
});
