import { describe, it, expect } from "vitest";
import * as a11y from "./index.js";

describe("public surface", () => {
  it("exposes exactly snapshotAccessibility, findByRole, findByName", () => {
    expect(typeof a11y.snapshotAccessibility).toBe("function");
    expect(typeof a11y.findByRole).toBe("function");
    expect(typeof a11y.findByName).toBe("function");
    expect(Object.keys(a11y).sort()).toEqual(
      ["findByName", "findByRole", "snapshotAccessibility"].sort(),
    );
  });
});
