/* -------------------------------------------------------------------------- */
/*  sendStatus — unsigned send hand-off + review-pending status flag           */
/*                                                                            */
/*  §13 Path 2: tap Send while unsigned → park the recording, stash its         */
/*  session_id here, redirect to OAuth. After auth the global                  */
/*  <WillabPendingSend> reads it back and runs merge-then-send (§3.5).         */
/*                                                                            */
/*  `review_pending` is a separate persisted status flag so the Lounge shows    */
/*  the "with your coach" chip after a send AND across a reload (both paths).   */
/*  Best-effort localStorage (Safari private mode fails soft).                 */
/*  (Named distinctly from the WillabPendingSend component — case-only          */
/*  filename clashes break case-insensitive filesystems.)                      */
/* -------------------------------------------------------------------------- */

const SEND_KEY = "willab.pending_send";
const REVIEW_KEY = "willab.review_pending";
const INSIGHTS_KEY = "willab.insights_ready";

function get(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* swallow */
  }
}
function del(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* swallow */
  }
}

export function setPendingSend(sessionId: string): void {
  set(SEND_KEY, sessionId);
}
export function getPendingSend(): string | null {
  return get(SEND_KEY);
}
export function clearPendingSend(): void {
  del(SEND_KEY);
}

export function setReviewPending(sessionId?: string | null): void {
  set(REVIEW_KEY, sessionId ? sessionId : "1");
}
export function getReviewPending(): string | null {
  // The in-review session id, so the Lounge can open its Readout while it's with
  // the coach. null when pending without an id (legacy "1" value).
  const v = get(REVIEW_KEY);
  return v && v !== "1" ? v : null;
}
export function hasReviewPending(): boolean {
  return get(REVIEW_KEY) != null;
}
export function clearReviewPending(): void {
  del(REVIEW_KEY);
}

/* insights_ready — the published session whose coach read is unread. Set when
   review_pending flips to published (live sub or on-load reconcile); carries the
   session id so the status card's "Read ›" can open that session's Insights.
   Cleared on read. */
export function setInsightsReady(sessionId: string): void {
  set(INSIGHTS_KEY, sessionId);
}
export function getInsightsReady(): string | null {
  return get(INSIGHTS_KEY);
}
export function clearInsightsReady(): void {
  del(INSIGHTS_KEY);
}
