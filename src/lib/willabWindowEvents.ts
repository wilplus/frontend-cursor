/** Dispatched on `window` when something has just SPENT tokens, so the header
 *  chip re-reads instead of sitting on a stale number until its next poll.
 *
 *  A window event rather than shared state because the spenders (a moment
 *  unlock inside a stacked overlay, a take) are nowhere near the header in the
 *  tree, and threading a callback down to each of them coupled to the wallet
 *  is how the two menus drifted apart the first time. Balance reads are free
 *  (no endpoint charges), so an extra one costs nothing. */
export const WILLAB_TOKENS_SPENT_EVENT = "willab:tokens-spent";

/** Fire-and-forget: safe to call when pricing is off, on the server, or with
 *  no wallet mounted. Nothing listening is the normal case. */
export function notifyTokensSpent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WILLAB_TOKENS_SPENT_EVENT));
}

/** Dispatched when the speaker leaves a surface for the chat on purpose (the
 *  Ideal Text's "See next steps"), so the Lounge lands on the newest bubble
 *  rather than wherever the thread was left (founder 2026-09-28). */
export const WILLAB_THREAD_TO_LATEST_EVENT = "willab:thread-to-latest";

export function notifyThreadToLatest(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WILLAB_THREAD_TO_LATEST_EVENT));
}
