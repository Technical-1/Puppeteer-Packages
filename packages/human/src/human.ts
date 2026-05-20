import type { Page } from "puppeteer-core";

export type RandomFn = () => number;

function between(min: number, max: number, rand: RandomFn): number {
  return min + rand() * (max - min);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface DelayOptions {
  minMs?: number;
  maxMs?: number;
  rand?: RandomFn;
}

/** Wait a randomized delay in [minMs, maxMs] (default 50–250). */
export async function humanDelay(opts: DelayOptions = {}): Promise<void> {
  const min = opts.minMs ?? 50;
  const max = opts.maxMs ?? 250;
  await sleep(between(min, max, opts.rand ?? Math.random));
}

export interface TypeOptions {
  minKeyMs?: number;
  maxKeyMs?: number;
  rand?: RandomFn;
}

/** Type text one key at a time with a randomized inter-key delay. */
export async function humanType(
  page: Page,
  selector: string,
  text: string,
  opts: TypeOptions = {},
): Promise<void> {
  const min = opts.minKeyMs ?? 40;
  const max = opts.maxKeyMs ?? 160;
  const rand = opts.rand ?? Math.random;
  await page.focus(selector);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(between(min, max, rand));
  }
}

export interface MousePoint {
  x: number;
  y: number;
}

export interface MouseMoveOptions {
  steps?: number;
}

/** Move the mouse from `from` to `to` in `steps` linear increments. */
export async function humanMouseMove(
  page: Page,
  from: MousePoint,
  to: MousePoint,
  opts: MouseMoveOptions = {},
): Promise<void> {
  const steps = Math.max(1, opts.steps ?? 12);
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await page.mouse.move(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
    );
  }
}
