import { addExtra } from "puppeteer-extra";
// puppeteer-extra-plugin-stealth ships CJS `export =`. Under NodeNext +
// verbatimModuleSyntax the roadmap convention is `import = require`, but that
// form compiles to a synchronous `require()` call which Vitest's ESM mock
// system cannot intercept.  A default import (`import StealthPlugin from …`)
// satisfies verbatimModuleSyntax here because esModuleInterop:true is set and
// TypeScript does NOT raise TS1259 for this package under the project tsconfig
// — the import emits as a plain ESM `import` statement that vi.mock CAN
// intercept.  `addExtra` is a named export → normal named import.
import StealthPlugin from "puppeteer-extra-plugin-stealth";

/**
 * Wrap a puppeteer instance with `puppeteer-extra` and apply the stealth
 * plugin. Returns the stealth-enhanced launcher (use its `.launch`).
 */
export function applyStealth<T>(puppeteer: T): ReturnType<typeof addExtra> {
  const enhanced = addExtra(puppeteer as never);
  enhanced.use(StealthPlugin());
  return enhanced;
}
