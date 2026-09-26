import { getAuthToken } from "@/lib/api/auth-client";
import {
  fetchAuthorization,
  type AuthorizationStatus,
} from "./processingAuthorization";
import { fetchLoungeHistory, type LoungeHistoryPage } from "./loungeMessages";

/* -------------------------------------------------------------------------- */
/*  bootPrefetch — start /chat's boot reads together, not one gate at a time   */
/*                                                                            */
/*  A signed-in reload used to be a WATERFALL: the flow state resolved, then   */
/*  Phase1AcceptanceGate mounted and fetched /processing-authorization, and    */
/*  only once it passed did LoungeThreadProvider mount and fetch the thread.   */
/*  Each hop is a BFF call (Supabase + backend), and the backend has two sync  */
/*  workers, so one queued hop delayed every hop behind it — the "sometimes    */
/*  very slow" boot, spent staring at the loader.                              */
/*                                                                            */
/*  useWillabFlow now fires both reads on mount; each gate TAKES the in-flight */
/*  promise instead of starting its own. Nothing about the gates changes: the  */
/*  same request, the same response, the same decision — only earlier.        */
/*                                                                            */
/*  One-shot by design. `take` removes the entry, so a gate's retry (Phase1's  */
/*  PROCESSING_POLICY_STALE bump, a sign-in re-running the thread load) always */
/*  goes to the network. An entry older than MAX_AGE_MS is ignored for the     */
/*  same reason: a gate mounted long after boot must not read boot-time state. */
/* -------------------------------------------------------------------------- */

const MAX_AGE_MS = 15_000;

interface Entry<T> {
  startedAt: number;
  promise: Promise<T | undefined>;
}

const entries = new Map<string, Entry<unknown>>();

function remember<T>(key: string, start: () => Promise<T | undefined>): void {
  if (entries.has(key)) return;
  // A prefetch must never surface an unhandled rejection; `undefined` makes
  // the consumer fall back to its own fetch, exactly as before.
  const promise = start().catch(() => undefined);
  entries.set(key, { startedAt: Date.now(), promise });
}

/** The prefetched value, or `undefined` when there is none to use (never
 *  started, already taken, stale, or the prefetch declined) — in which case
 *  the caller fetches as it always did. */
async function take<T>(key: string): Promise<T | undefined> {
  const entry = entries.get(key) as Entry<T> | undefined;
  entries.delete(key);
  if (!entry || Date.now() - entry.startedAt > MAX_AGE_MS) return undefined;
  return entry.promise;
}

const AUTHORIZATION = "processing-authorization";
const LOUNGE_HISTORY = "lounge-history";

/** Fire the boot reads. Idempotent while entries are pending. */
export function prefetchChatBoot(): void {
  remember(AUTHORIZATION, fetchAuthorization);
  remember(LOUNGE_HISTORY, async () => {
    // fetchLoungeHistory answers "no session" with an EMPTY page, which is
    // indistinguishable from an empty thread. Only a signed-in read may be
    // reused; otherwise decline, and the signed-in load fetches for itself.
    if (!(await getAuthToken())) return undefined;
    return fetchLoungeHistory();
  });
}

/** Phase1AcceptanceGate's first check: the prefetched status or a fresh one. */
export async function takeAuthorization(): Promise<AuthorizationStatus> {
  return (await take<AuthorizationStatus>(AUTHORIZATION)) ?? fetchAuthorization();
}

/** useLoungeThread's signed-in load: the prefetched page or a fresh one. */
export async function takeLoungeHistory(): Promise<LoungeHistoryPage> {
  return (await take<LoungeHistoryPage>(LOUNGE_HISTORY)) ?? fetchLoungeHistory();
}

/** Test-only reset. */
export function __resetBootPrefetchForTests(): void {
  entries.clear();
}
