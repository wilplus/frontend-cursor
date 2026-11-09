import { getAuthToken } from "@/lib/api/auth-client";
import {
  fetchAuthorization,
  type AuthorizationStatus,
} from "./processingAuthorization";
import { fetchLoungeHistory, type LoungeHistoryPage } from "./loungeMessages";
import { loadRingState } from "./rings";
import { getChats, type Chat } from "./chats";
import { fetchSessionState, type SessionStateValue } from "./chatSessionState";
import { getAccess, wasMemberHere } from "./access";
import { markChatBootStarted } from "@/lib/chatBoot";

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

/** The thread's first page at open: a read that hangs reaches the Lounge's
 *  "no answer" (the typing dots, read again) instead of holding it. */
const FIRST_PAGE_TIMEOUT_MS = 10_000;

const AUTHORIZATION = "processing-authorization";
const LOUNGE_HISTORY = "lounge-history";
const CHATS = "chats";
const SESSION_STATE = "session-state";

function rememberThread(): void {
  remember(LOUNGE_HISTORY, async () => {
    // fetchLoungeHistory answers "no session" with an EMPTY page, which is
    // indistinguishable from an empty thread. Only a signed-in read may be
    // reused; otherwise decline, and the signed-in load fetches for itself.
    if (!(await getAuthToken())) return undefined;
    return fetchLoungeHistory({ timeoutMs: FIRST_PAGE_TIMEOUT_MS });
  });
}

/** Fire the boot reads. Idempotent while entries are pending. */
export function prefetchChatBoot(): void {
  remember(AUTHORIZATION, fetchAuthorization);
  rememberThread();
}

/* -------------------------------------------------------------------------- */
/*  prefetchChatOpen — the boot reads start WITH the members check (2026-11-05) */
/*                                                                            */
/*  By invitation (backend N471), /chat first asks whether the account is a    */
/*  member (MembersOnly) and draws nothing until it answers; only then did    */
/*  useWillabFlow mount and start the reads above. One whole round trip in   */
/*  front of every boot read. page.client.tsx now calls this as /chat opens,  */
/*  past Welcome only (before it the flow reads nothing): the members check   */
/*  and the boot reads go out together, and each gate still TAKES its read    */
/*  exactly as before. Nothing about who gets in changes: MembersOnly still   */
/*  waits for the answer, and a read nobody takes is simply dropped.          */
/*                                                                            */
/*  What may start before the answer is only what changes nothing for an      */
/*  account the backend refuses (a waiting one):                              */
/*    - signed out: nothing at all, so no guest identity is ever minted;      */
/*    - signed in: the members check and the thread's newest page (a plain    */
/*      read; GET /v2/user/lounge/messages writes nothing);                   */
/*    - an account this device has seen let in before (access.ts): also the  */
/*      agreement status and the session state. Those two pass the backend's */
/*      processing gate, which writes the account's owner record the first   */
/*      time it is asked, so they never go early for an account not known    */
/*      here. A member stays a member (backend services/membership.py): for  */
/*      one let in before, they are the reads it makes a moment later anyway. */
/* -------------------------------------------------------------------------- */

export async function prefetchChatOpen(opts: { parked: boolean }): Promise<void> {
  if (!(await getAuthToken())) return;
  // The boot has started here, a members check before useWillabFlow mounts
  // and marks it: what waits for the thread (chatBoot.ts; the app's push
  // registration, in the layout) must not go out with these reads.
  markChatBootStarted();
  void getAccess(); // MembersOnly shares this one request
  rememberThread();
  if (!(await wasMemberHere())) return;
  remember(AUTHORIZATION, fetchAuthorization);
  // A parked Readout opens without the session state (useWillabFlow).
  if (!opts.parked) remember(SESSION_STATE, fetchSessionState);
}

/** The chats door's read (useChatsDoor): the list, early, for every
 *  signed-in person (backend N456). Fired AFTER the Lounge's own boot reads
 *  (session state, authorization, the thread) so they never queue behind
 *  the chats. The rings are still read early here for the features they do
 *  decide; the chats no longer wait on them. */
export function prefetchChatsDoor(): void {
  void loadRingState(); // the one shared read per page load (rings.ts)
  remember(CHATS, async () => {
    // Signed out, the read would fail for a reason that is not the answer.
    if (!(await getAuthToken())) return undefined;
    return (await getChats()) ?? undefined;
  });
}

/** useChatList's first read: the prefetched list or a fresh one. */
export async function takeChats(): Promise<Chat[] | null> {
  return (await take<Chat[]>(CHATS)) ?? getChats();
}

/** useWillabFlow's session state: the one read at /chat's open, or a fresh one. */
export async function takeSessionState(): Promise<SessionStateValue | null> {
  const prefetched = await take<SessionStateValue | null>(SESSION_STATE);
  return prefetched !== undefined ? prefetched : fetchSessionState();
}

/** Phase1AcceptanceGate's first check: the prefetched status or a fresh one. */
export async function takeAuthorization(): Promise<AuthorizationStatus> {
  return (await take<AuthorizationStatus>(AUTHORIZATION)) ?? fetchAuthorization();
}

/** useLoungeThread's signed-in load: the prefetched page or a fresh one. */
export async function takeLoungeHistory(): Promise<LoungeHistoryPage> {
  return (await take<LoungeHistoryPage>(LOUNGE_HISTORY)) ?? fetchLoungeHistory({ timeoutMs: FIRST_PAGE_TIMEOUT_MS });
}

/** Test-only reset. */
export function __resetBootPrefetchForTests(): void {
  entries.clear();
}
