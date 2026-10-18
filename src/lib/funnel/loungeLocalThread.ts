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
  if (local.length === 0) return [];
  const ordered = mergeableLocalMessages(local);
  const persisted = ordered.length ? await appendAllLoungeMessages(ordered) : [];
  clearLocalLoungeThread();
  return persisted;
}

/** The local messages the account's thread takes, in chronological order.
 *
 *  ONE IDEAL TEXT BUBBLE PER TAKE (founder 2026-10-18: "I can see two
 *  bubbles; there should be just one"). A guest's "your text is ready" card
 *  is posted by the page, under an id of its own, because a guest has no
 *  server thread; the claim that precedes this merge back-fills the same
 *  card into the account under the server's id. Replaying the guest's copy
 *  too put two cards for one Take in the chat. The server's card is the one
 *  that stays, so the guest's copy is not replayed. */
export function mergeableLocalMessages(local: readonly LoungeMessage[]): LoungeMessage[] {
  return local
    .filter((m) => !(m.kind === "ideal_text" && m.metadata?.variant === "ready"))
    .sort((a, b) => (a.client_created_at < b.client_created_at ? -1 : 1));
}
