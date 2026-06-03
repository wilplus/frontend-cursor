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
  // Defensive: ensure chronological order before replaying.
  const ordered = [...local].sort((a, b) =>
    a.client_created_at < b.client_created_at ? -1 : 1
  );
  const persisted = await appendAllLoungeMessages(ordered);
  clearLocalLoungeThread();
  return persisted;
}
