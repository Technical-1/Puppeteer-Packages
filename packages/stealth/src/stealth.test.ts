import { describe, it, expect, vi } from "vitest";

const { useSpy, extraInstance, addExtraSpy, stealthPluginSpy } = vi.hoisted(() => {
  const useSpy = vi.fn();
  const extraInstance = { use: useSpy };
  const addExtraSpy = vi.fn(() => extraInstance);
  const stealthPluginSpy = vi.fn(() => ({ name: "stealth" }));
  return { useSpy, extraInstance, addExtraSpy, stealthPluginSpy };
});

vi.mock("puppeteer-extra", () => ({ addExtra: addExtraSpy }));
vi.mock("puppeteer-extra-plugin-stealth", () => ({ default: stealthPluginSpy }));

import { applyStealth } from "./stealth.js";

describe("applyStealth", () => {
  it("wraps the puppeteer instance with addExtra and applies the stealth plugin", () => {
    const puppeteer = { launch: vi.fn() };
    const result = applyStealth(puppeteer as never);
    expect(addExtraSpy).toHaveBeenCalledWith(puppeteer);
    expect(stealthPluginSpy).toHaveBeenCalledTimes(1);
    expect(useSpy).toHaveBeenCalledWith({ name: "stealth" });
    expect(result).toBe(extraInstance);
  });
});
