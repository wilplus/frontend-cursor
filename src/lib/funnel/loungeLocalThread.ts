/**
 * Unsigned-visitor half of the Lounge thread (§3 / §11).
 *
 * Signed-in users persist server-side (`lounge_messages`); unsigned
 * visitors keep their thread here in `localStorage` so it survives reload
 * on the same device. On sign-up the local thread is **merged
 * chronologically** into the server thread (append, never overwrite) via
 * the same POST endpoint — `client_id` dedupes, `client_created_at`
 * preserves order.
 *
 * All accesses are try/catch'd (Safari private mode / quota) so the worst
 * case is a lost local thread, never a crash — mirrors the other
 * `lib/funnel/*` one-shots.
 */

import {
  appendAllLoungeMessages,
  type LoungeMessage,
} from "@/services/api/loungeMessages";

export const LOUNGE_LOCAL_KEY = "willab.lounge_thread";

/** A visitor's thread is theirs for one sitting. After this long since the
 *  last message it is dropped, so the next person on the device (a shared
 *  phone, a demo) starts clean (founder 2026-10-16). */
export const LOUNGE_LOCAL_TTL_MS = 60 * 60 * 1000;

/** Read the full local thread (ASC by client_created_at — caller-maintained). */
export function readLocalLoungeThread(): LoungeMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOUNGE_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LoungeMessage[]) : [];
  } catch {
    return [];
  }
}

/** The thread for a new sitting: the stored one, or nothing when its newest
 *  message is older than the TTL (that thread is dropped). The Lounge calls
 *  this once on load; appends never expire a thread mid-conversation. */
export function loadLocalLoungeThread(now: number = Date.now()): LoungeMessage[] {
  const thread = readLocalLoungeThread();
  if (!isStale(thread, now)) return thread;
  clearLocalLoungeThread();
  return [];
}

/** True when the newest message is older than the TTL. Pure; exported for
 *  the test. A thread without a readable timestamp is kept. */
export function isStale(thread: LoungeMessage[], now: number): boolean {
  const newest = thread.reduce<number>((acc, m) => {
    const t = Date.parse(m.client_created_at);
    return Number.isNaN(t) ? acc : Math.max(acc, t);
  }, 0);
  return newest > 0 && now - newest > LOUNGE_LOCAL_TTL_MS;
}

function writeLocalLoungeThread(messages: LoungeMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOUNGE_LOCAL_KEY, JSON.stringify(messages));
  } catch {
    /* swallow — private mode / quota */
  }
}

/**
 * Append an already-stamped message to the local thread. Idempotent on
 * `client_id` (a re-append of the same message is a no-op) so the local
 * store mirrors the server's `(user_id, client_id)` uniqueness.
 */
export function appendLocalLoungeMessage(msg: LoungeMessage): LoungeMessage[] {
  const thread = readLocalLoungeThread();
  if (thread.some((m) => m.client_id === msg.client_id)) return thread;
  const next = [...thread, msg];
  writeLocalLoungeThread(next);
  return next;
}

/** Drop the local thread entirely (after a successful merge, or on clear). */
export function clearLocalLoungeThread(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOUNGE_LOCAL_KEY);
  } catch {
    /* swallow */
  }
}

/**
 * Merge the local thread into the server thread on sign-up.
 *
 * Replays the localStorage thread as batches through the standard append
 * endpoint (auto-chunked to the 200/POST ceiling). `client_created_at`
 * preserves order; `client_id` dedupes, so a double-merge (re-run signup,
 * double callback) is safe. Clears the local thread only after the
 * server confirms — a failed merge leaves the local copy intact to retry.
 *
 * Returns the persisted rows. Empty local thread → no-op.
 */
export async function mergeLocalLoungeThreadToServer(): Promise<LoungeMessage[]> {
  const local = readLocalLoungeThread();
  if (local.length === 0) {
    clearClaimedThreadMark();
    return [];
  }
  // Every message is replayed, the guest's own "your text is ready" card
  // included: when the Take is sent to the coach the server back-fills the
  // same card under its own id, and the chat draws one card per version
  // (unreadFeedback.ts), so the two never show together. Without a send
  // there is no server card, and the guest's is the only way back to the
  // text (founder 2026-10-20).
  const ordered = [...local].sort((a, b) =>
    a.client_created_at < b.client_created_at ? -1 : 1
  );
  const persisted = await appendAllLoungeMessages(ordered);
  clearLocalLoungeThread();
  clearClaimedThreadMark();
  return persisted;
}

/* -------------------------------------------------------------------------- */
/*  THE CHAT FOLLOWS THE TAKE INTO THE ACCOUNT (founder 2026-10-20: "after I  */
/*  sign up ... it shows me a button like my take was not registered").       */
/*                                                                            */
/*  The guest's thread used to reach the account only through the pending    */
/*  coach send, which exists only when the guest signed up from the ready     */
/*  screen. A guest who chose "Not now" and signed up later had their Take    */
/*  claimed into the account and their chat left behind: an empty chat. Now   */
/*  the claim that moves a guest into an account marks the thread on this     */
/*  device as that account's, and a marked thread is merged on the next      */
/*  signed-in open (or at once). The mark, not a sign-in alone, decides: a   */
/*  thread on a shared device is never merged into whoever signs in next.    */
/* -------------------------------------------------------------------------- */

const CLAIMED_THREAD_KEY = "willab.lounge_thread_claimed";

/** The chat on this device belongs to the account that just claimed it. */
export function markLocalThreadClaimed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAIMED_THREAD_KEY, "1");
  } catch {
    /* swallow — private mode; the pending send still merges */
  }
}

function claimedThreadMarked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CLAIMED_THREAD_KEY) === "1";
  } catch {
    return false;
  }
}

function clearClaimedThreadMark(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLAIMED_THREAD_KEY);
  } catch {
    /* swallow */
  }
}

/** The Lounge re-reads its thread when this fires. */
export const LOUNGE_THREAD_MERGED_EVENT = "willab:lounge-thread-merged";

/** Merge the thread on this device into the account, when a claim marked it
 *  as the account's. True when something was merged (the Lounge is told). */
export async function mergeClaimedLocalThread(): Promise<boolean> {
  if (!claimedThreadMarked()) return false;
  const persisted = await mergeLocalLoungeThreadToServer();
  if (persisted.length && typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOUNGE_THREAD_MERGED_EVENT));
  }
  return persisted.length > 0;
}
