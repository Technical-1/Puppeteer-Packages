import type { HTTPRequest, Page } from "puppeteer-core";
import type { ContinueRequestOverrides, ErrorCode, ResponseForRequest } from "puppeteer-core";

/**
 * A decision returned by an interceptor for one request. `undefined` means
 * "no opinion, let the next interceptor decide (or fall through to a bare
 * `continue()`)".
 */
export type InterceptDecision =
  | { readonly action: "abort"; readonly errorCode?: ErrorCode }
  | { readonly action: "respond"; readonly response: Partial<ResponseForRequest> }
  | { readonly action: "continue"; readonly overrides?: ContinueRequestOverrides }
  | undefined;

/**
 * A registered request handler. The first interceptor to return a
 * non-`undefined` decision wins for that request.
 */
export type Interceptor = (req: HTTPRequest) => InterceptDecision | Promise<InterceptDecision>;

interface InterceptionState {
  interceptors: Interceptor[];
  listener: (req: HTTPRequest) => Promise<void>;
}

/**
 * Per-page single-owner interception registry. EXACTLY ONE place in the whole
 * package calls `page.setRequestInterception(true)` — here — so multiple
 * consumers (blockResources, mockRequests) compose through one shared `request`
 * listener instead of racing two `setRequestInterception` registrations (which
 * makes puppeteer-core throw "Request is already handled"). Weak so the registry
 * follows the page's GC lifetime.
 */
const STATE: WeakMap<Page, InterceptionState> = new WeakMap();

async function applyDecision(req: HTTPRequest, decision: InterceptDecision): Promise<boolean> {
  if (decision === undefined) return false;
  if (decision.action === "abort") {
    await req.abort(decision.errorCode);
  } else if (decision.action === "respond") {
    await req.respond(decision.response);
  } else {
    await req.continue(decision.overrides ?? {});
  }
  return true;
}

/**
 * Register `interceptor` as a consumer of `page`'s request interception. Enables
 * `setRequestInterception(true)` and attaches the single shared `request`
 * listener the FIRST time any consumer registers on `page`; subsequent
 * registrations only append to the ordered interceptor list — interception is
 * never enabled twice. Returns a disposer that removes just this interceptor.
 */
export async function registerInterceptor(
  page: Page,
  interceptor: Interceptor,
): Promise<() => void> {
  let state = STATE.get(page);
  if (state === undefined) {
    const interceptors: Interceptor[] = [];
    const listener = async (req: HTTPRequest): Promise<void> => {
      try {
        for (const it of interceptors) {
          const decision = await it(req);
          if (await applyDecision(req, decision)) return;
        }
        await req.continue();
      } catch {
        // Race: the request was already handled (cross-realm / another consumer)
        // — puppeteer-core throws on double-handle. Swallow, as blockResources
        // did, so the listener never rejects into an unhandled rejection.
      }
    };
    await page.setRequestInterception(true);
    page.on("request", listener);
    state = { interceptors, listener };
    STATE.set(page, state);
  }
  const { interceptors } = state;
  interceptors.push(interceptor);

  let disposed = false;
  return (): void => {
    if (disposed) return;
    disposed = true;
    const idx = interceptors.indexOf(interceptor);
    if (idx >= 0) interceptors.splice(idx, 1);
  };
}

/**
 * If no interceptors remain on `page`, detach the shared listener and disable
 * interception. Idempotent; a no-op while any consumer is still registered.
 */
export async function teardownIfEmpty(page: Page): Promise<void> {
  const state = STATE.get(page);
  if (state === undefined || state.interceptors.length > 0) return;
  page.off("request", state.listener);
  STATE.delete(page);
  await page.setRequestInterception(false);
}
