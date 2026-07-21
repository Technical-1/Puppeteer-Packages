/**
 * How to detect a state (authenticated, or MFA-challenge-ready):
 * - `{ selector }` — wait for this selector to become visible (delegates to
 *   page.waitForSelector({ visible: true })).
 * - `{ urlPredicate }` — a Node-side predicate polled against page.url() until true.
 * Exactly one form is supplied; the `never` sibling makes the union discriminated.
 */
export type AuthCheck =
  | { selector: string; urlPredicate?: never }
  | { urlPredicate: (url: string) => boolean; selector?: never };

/**
 * Optional MFA / OTP step, run after submit and before the authenticated-state wait.
 * - `waitFor` — pause until this challenge-ready state holds (outcome wait → TimeoutError).
 * - `codeSelector` + `code` — when both given, type the code into the field. `code`
 *   may be a string or a (sync/async) supplier resolved at call time (e.g. read an OTP).
 * - `submitSelector` — clicked after the code is entered, when given.
 */
export interface MfaStep {
  waitFor?: AuthCheck;
  codeSelector?: string;
  code?: string | (() => string | Promise<string>);
  submitSelector?: string;
}

/** The login form description the caller supplies. */
export interface LoginSteps {
  usernameSelector: string;
  username: string;
  passwordSelector: string;
  password: string;
  submitSelector: string;
  authenticated: AuthCheck;
  mfa?: MfaStep;
}

/** Result of a successful login. */
export interface LoginResult {
  /** page.url() after the authenticated state was confirmed. */
  url: string;
  /** True when an MFA step was configured and executed. */
  mfaPerformed: boolean;
}
