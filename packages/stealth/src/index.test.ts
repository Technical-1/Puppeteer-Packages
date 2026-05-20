import { describe, it, expect, vi } from "vitest";

vi.mock("puppeteer-extra", () => ({ addExtra: vi.fn(() => ({ use: vi.fn() })) }));
vi.mock("puppeteer-extra-plugin-stealth", () => ({ default: vi.fn() }));

import * as stealth from "./index.js";

describe("public surface", () => {
  it("exposes applyStealth only", () => {
    expect(typeof stealth.applyStealth).toBe("function");
    expect(Object.keys(stealth).sort()).toEqual(["applyStealth"].sort());
  });
});
