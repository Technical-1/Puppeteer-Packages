import { describe, it, expect } from "vitest";
import { dedupSourcemapComment } from "./dedup-sourcemap.js";

describe("dedupSourcemapComment", () => {
  it("removes duplicate trailing sourceMappingURL comments", () => {
    const input = `console.log(1);
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
`;
    const expected = `console.log(1);
//# sourceMappingURL=index.js.map
`;
    expect(dedupSourcemapComment(input)).toBe(expected);
  });

  it("leaves a single sourceMappingURL alone", () => {
    const input = `console.log(1);
//# sourceMappingURL=index.js.map
`;
    expect(dedupSourcemapComment(input)).toBe(input);
  });

  it("leaves files without sourceMappingURL alone", () => {
    const input = `console.log(1);\n`;
    expect(dedupSourcemapComment(input)).toBe(input);
  });

  it("collapses 3+ consecutive identical sourceMappingURL lines to one", () => {
    const input = `console.log(1);
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
`;
    const expected = `console.log(1);
//# sourceMappingURL=index.js.map
`;
    expect(dedupSourcemapComment(input)).toBe(expected);
  });

  it("handles no trailing newline after the last duplicate", () => {
    const input =
      "console.log(1);\n//# sourceMappingURL=index.js.map\n//# sourceMappingURL=index.js.map";
    const expected = "console.log(1);\n//# sourceMappingURL=index.js.map";
    expect(dedupSourcemapComment(input)).toBe(expected);
  });
});
