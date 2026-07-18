/** The four JS dialog kinds Chrome/puppeteer surface via the 'dialog' event. */
export type DialogKind = "alert" | "confirm" | "prompt" | "beforeunload";

/** What to do with a dialog: accept (OK) or dismiss (Cancel). */
export type DialogDisposition = "accept" | "dismiss";

/** Per-type decision. `promptText` only applies when accepting a `prompt`. */
export interface DialogRule {
  action: DialogDisposition;
  promptText?: string;
}

/** Optional per-type policy. Any omitted kind falls back to `defaultAction`. */
export type DialogPolicy = {
  [K in DialogKind]?: DialogRule;
};

/** Immutable record of one handled dialog, appended to `DialogHandler.handled`. */
export interface DialogEvent {
  type: DialogKind;
  message: string;
  defaultValue: string;
  action: DialogDisposition;
  promptText?: string;
}
