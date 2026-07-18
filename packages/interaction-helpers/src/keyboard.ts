import type { Page, KeyInput } from "puppeteer-core";
import type { LoggerOption } from "@technical-1/core";

export interface KeyboardOptions extends LoggerOption {}

/** Press a single key (e.g. "Enter", "Escape", "Tab", "KeyA"). */
export async function pressKey(
  page: Page,
  key: KeyInput,
  opts: KeyboardOptions = {},
): Promise<void> {
  opts.logger?.log(`press ${key}`, "step");
  await page.keyboard.press(key);
}

/**
 * Send a modifier + key combination (e.g. Ctrl+A, Cmd+V). Holds every modifier
 * down, presses `key`, then releases the modifiers in reverse order. The
 * release runs in a `finally` so modifiers never stay stuck if the press throws.
 * Choose "Control" vs "Meta" for the Ctrl-vs-Cmd platform distinction.
 */
export async function pressShortcut(
  page: Page,
  modifiers: KeyInput | KeyInput[],
  key: KeyInput,
  opts: KeyboardOptions = {},
): Promise<void> {
  const mods = Array.isArray(modifiers) ? modifiers : [modifiers];
  opts.logger?.log(`shortcut ${[...mods, key].join("+")}`, "step");
  for (const m of mods) await page.keyboard.down(m);
  try {
    await page.keyboard.press(key);
  } finally {
    for (let i = mods.length - 1; i >= 0; i--) await page.keyboard.up(mods[i]!);
  }
}
