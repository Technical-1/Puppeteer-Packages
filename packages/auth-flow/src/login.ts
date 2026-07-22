import type { Page } from "puppeteer-core";
import { ConfigError, SelectorNotFoundError, TimeoutError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";
import type { AuthCheck, LoginResult, LoginSteps, MfaStep } from "./types.js";

export interface LoginOptions extends LoggerOption {
  /** Visible-wait timeout for each required form field (ms). Default 15000. */
  timeout?: number;
  /** Timeout for the authenticated-state / MFA-ready waits (ms). Default 30000. */
  authTimeout?: number;
  /** Poll interval for a urlPredicate auth-check (ms). Default 100. */
  pollInterval?: number;
  /** Per-keystroke delay when typing credentials/code (ms). Default 0. */
  typeDelay?: number;
}

const DEFAULT_FIELD_TIMEOUT = 15000;
const DEFAULT_AUTH_TIMEOUT = 30000;
const DEFAULT_POLL_INTERVAL = 100;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for a required form field to be visible; a miss is a terminal SelectorNotFoundError. */
async function waitField(
  page: Page,
  selector: string,
  timeout: number,
): Promise<void> {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
  } catch (cause) {
    throw new SelectorNotFoundError(selector, { cause });
  }
}

/**
 * Wait for an outcome state (authenticated, or MFA-ready). A miss is a
 * retryable TimeoutError — distinct from a missing form field, which is a
 * terminal SelectorNotFoundError.
 */
async function waitForState(
  page: Page,
  check: AuthCheck,
  timeout: number,
  pollInterval: number,
  label: string,
): Promise<void> {
  if (check.selector !== undefined) {
    try {
      await page.waitForSelector(check.selector, { visible: true, timeout });
    } catch (cause) {
      throw new TimeoutError(
        `auth-flow: ${label} selector "${check.selector}" not visible within ${timeout}ms`,
        { cause, context: { label, selector: check.selector, timeout } },
      );
    }
    return;
  }
  const predicate = check.urlPredicate;
  const deadline = Date.now() + timeout;
  for (;;) {
    if (predicate(page.url())) return;
    if (Date.now() >= deadline) {
      throw new TimeoutError(
        `auth-flow: ${label} urlPredicate not satisfied within ${timeout}ms`,
        { context: { label, url: page.url(), timeout } },
      );
    }
    await sleep(pollInterval);
  }
}

interface StepConfig {
  fieldTimeout: number;
  authTimeout: number;
  pollInterval: number;
  typeDelay: number;
  logger: LoginOptions["logger"];
}

async function runMfa(
  page: Page,
  mfa: MfaStep,
  cfg: StepConfig,
): Promise<void> {
  const hasCode = mfa.code !== undefined;
  const hasCodeSelector = mfa.codeSelector !== undefined;
  if (hasCode !== hasCodeSelector) {
    throw new ConfigError(
      "auth-flow: MFA `code` and `codeSelector` must be provided together",
      { context: { hasCode, hasCodeSelector } },
    );
  }
  if (mfa.submitSelector !== undefined && !(hasCode && hasCodeSelector)) {
    throw new ConfigError(
      "auth-flow: MFA `submitSelector` requires both `code` and `codeSelector`",
      { context: {} },
    );
  }
  if (mfa.waitFor === undefined && !hasCode && !hasCodeSelector) {
    throw new ConfigError(
      "auth-flow: MFA step must specify `waitFor` or a `code`+`codeSelector` pair",
      { context: {} },
    );
  }

  cfg.logger?.log("auth-flow: handling MFA step", "step");
  if (mfa.waitFor) {
    await waitForState(page, mfa.waitFor, cfg.authTimeout, cfg.pollInterval, "mfa");
  }
  if (mfa.code !== undefined && mfa.codeSelector !== undefined) {
    await waitField(page, mfa.codeSelector, cfg.fieldTimeout);
    const code = typeof mfa.code === "function" ? await mfa.code() : mfa.code;
    await page.type(mfa.codeSelector, code, { delay: cfg.typeDelay });
    if (mfa.submitSelector !== undefined) {
      await waitField(page, mfa.submitSelector, cfg.fieldTimeout);
      await page.click(mfa.submitSelector);
    }
  }
}

/**
 * Orchestrate a login: fill the username & password fields, click submit, run an
 * optional MFA/OTP step, then wait for the authenticated state (a visible selector
 * or a urlPredicate polled against page.url()). Returns the settled URL and whether
 * an MFA step ran.
 *
 * A required form-field selector that never appears throws SelectorNotFoundError
 * (terminal). An authenticated-state or MFA-ready wait that times out throws
 * TimeoutError (retryable). All from @technical-1/core.
 */
export async function login(
  page: Page,
  steps: LoginSteps,
  opts: LoginOptions = {},
): Promise<LoginResult> {
  const cfg: StepConfig = {
    fieldTimeout: opts.timeout ?? DEFAULT_FIELD_TIMEOUT,
    authTimeout: opts.authTimeout ?? DEFAULT_AUTH_TIMEOUT,
    pollInterval: opts.pollInterval ?? DEFAULT_POLL_INTERVAL,
    typeDelay: opts.typeDelay ?? 0,
    logger: opts.logger,
  };

  cfg.logger?.log(`auth-flow: filling username ${steps.usernameSelector}`, "step");
  await waitField(page, steps.usernameSelector, cfg.fieldTimeout);
  await page.type(steps.usernameSelector, steps.username, { delay: cfg.typeDelay });

  cfg.logger?.log("auth-flow: filling password", "step");
  await waitField(page, steps.passwordSelector, cfg.fieldTimeout);
  await page.type(steps.passwordSelector, steps.password, { delay: cfg.typeDelay });

  cfg.logger?.log(`auth-flow: submitting ${steps.submitSelector}`, "step");
  await waitField(page, steps.submitSelector, cfg.fieldTimeout);
  await page.click(steps.submitSelector);

  let mfaPerformed = false;
  if (steps.mfa !== undefined) {
    await runMfa(page, steps.mfa, cfg);
    mfaPerformed = true;
  }

  cfg.logger?.log("auth-flow: waiting for authenticated state", "step");
  await waitForState(
    page,
    steps.authenticated,
    cfg.authTimeout,
    cfg.pollInterval,
    "authenticated",
  );
  const url = page.url();
  cfg.logger?.log("auth-flow: authenticated", "success");
  return { url, mfaPerformed };
}
