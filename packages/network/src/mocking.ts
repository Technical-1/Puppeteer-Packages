import { NetworkError } from "@technical-1/core";
import type { HTTPRequest, Page } from "puppeteer-core";
import type { ContinueRequestOverrides, ErrorCode, ResponseForRequest } from "puppeteer-core";
import type { LoggerOption } from "@technical-1/core";
import type { InterceptDecision } from "./interception.js";
import { registerInterceptor, teardownIfEmpty } from "./interception.js";

/** What to do when a rule matches a request. Discriminated by `kind`. */
export type MockAction =
  | { readonly kind: "respond"; readonly response: Partial<ResponseForRequest> }
  | { readonly kind: "modify"; readonly overrides: ContinueRequestOverrides }
  | { readonly kind: "abort"; readonly errorCode?: ErrorCode };

/** A single mocking rule: match a request, then apply an action. */
export interface MockRule {
  /** Match by URL `RegExp` or an arbitrary predicate on the request. */
  readonly when: RegExp | ((req: HTTPRequest) => boolean);
  /** The action to apply to a matched request. */
  readonly action: MockAction;
}

export interface MockRequestsOptions extends LoggerOption {}

function ruleMatches(rule: MockRule, req: HTTPRequest): boolean {
  return rule.when instanceof RegExp ? rule.when.test(req.url()) : rule.when(req);
}

function toDecision(action: MockAction): InterceptDecision {
  if (action.kind === "respond") return { action: "respond", response: action.response };
  if (action.kind === "modify") return { action: "continue", overrides: action.overrides };
  return { action: "abort", errorCode: action.errorCode };
}

/**
 * Register `rules` as request mocks on `page`. The first rule whose `when`
 * matches a request applies its action (respond with a synthetic response,
 * continue with overrides, or abort with a specific error code); unmatched
 * requests fall through untouched (to blockResources or a bare continue()).
 * Returns an async disposer that removes just these mocks and disables
 * interception iff no other consumer remains.
 *
 * Throws `NetworkError` (`retryable:false`) for an empty rule list (programmer
 * error). Coordinates with blockResources through the shared interception owner
 * — it never calls setRequestInterception itself.
 */
export async function mockRequests(
  page: Page,
  rules: readonly MockRule[],
  opts: MockRequestsOptions = {},
): Promise<() => Promise<void>> {
  if (rules.length === 0) {
    throw new NetworkError("mockRequests requires at least one rule", { retryable: false });
  }
  const { logger } = opts;

  const dispose = await registerInterceptor(page, (req): InterceptDecision => {
    for (const rule of rules) {
      if (!ruleMatches(rule, req)) continue;
      logger?.log(`mockRequests: ${rule.action.kind} ${req.url()}`, "debug");
      return toDecision(rule.action);
    }
    return undefined;
  });

  return async (): Promise<void> => {
    dispose();
    await teardownIfEmpty(page);
  };
}
