import { bffFetch } from "@/lib/api/bffFetch";
import { readSession } from "@/lib/supabase/session";

/** By invitation (backend N471): whether the signed-in account may use the
 *  app, or is on the waitlist. Anything but a clear "not a member" lets the
 *  person through: an outage of this check never breaks the loop (CLAUDE.md,
 *  Never 3); the backend refuses a waiting account's work on its own. */
export type Access = "member" | "waiting";

/* -------------------------------------------------------------------------- */
/*  One question at a time, and a member is a member (2026-11-05).             */
/*                                                                            */
/*  /chat asks this before anything else is drawn, and its boot reads now      */
/*  start beside it (bootPrefetch.ts `prefetchChatOpen`), so two callers ask   */
/*  at once: they share the one request. A clear "member" from the server is   */
/*  kept for the life of the page, as the backend keeps it ("a member stays a  */
/*  member", services/membership.py); a "waiting" is never kept, so a person   */
/*  let in a moment later is let in at once.                                  */
/*                                                                            */
/*  The device also keeps WHICH account the server last let in (by its user   */
/*  id, never anything more). That is a hint for what may start early and     */
/*  nothing else: what decides is still the answer above.                     */
/* -------------------------------------------------------------------------- */

const MEMBER_HERE_KEY = "willab.member";

let inFlight: Promise<Access> | null = null;
/** The account the server called a member on this page. */
let memberThisPage: string | null = null;

async function signedInUserId(): Promise<string | null> {
  try {
    // The one shared read (lib/supabase/session.ts): /chat asks this twice
    // as it opens, beside every screen's own read of the sign-in.
    const session = await readSession();
    return session?.access_token ? session.user?.id ?? null : null;
  } catch {
    return null;
  }
}

function memberHere(): string | null {
  try {
    return window.localStorage.getItem(MEMBER_HERE_KEY);
  } catch {
    return null;
  }
}

function rememberHere(userId: string, member: boolean): void {
  try {
    if (member) window.localStorage.setItem(MEMBER_HERE_KEY, userId);
    else if (memberHere() === userId) window.localStorage.removeItem(MEMBER_HERE_KEY);
  } catch {
    /* private mode: only the early start is lost */
  }
}

async function readAccess(): Promise<Access> {
  const userId = await signedInUserId();
  if (userId && userId === memberThisPage) return "member";
  try {
    const result = await bffFetch("/api/v2/me/access", { method: "GET", cache: "no-store" });
    if (result.kind !== "response" || !result.ok) return "member";
    const body = result.body as { member?: unknown } | null;
    if (userId && body && typeof body.member === "boolean") {
      if (body.member) memberThisPage = userId;
      rememberHere(userId, body.member);
    }
    return body && body.member === false ? "waiting" : "member";
  } catch {
    return "member";
  }
}

export function getAccess(): Promise<Access> {
  if (!inFlight) {
    inFlight = readAccess().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Whether the server let the signed-in account in on this device before.
 *  Only says what may start early (bootPrefetch.ts); never who gets in. */
export async function wasMemberHere(): Promise<boolean> {
  const userId = await signedInUserId();
  return userId !== null && (userId === memberThisPage || userId === memberHere());
}

/** Test-only reset. */
export function __resetAccessForTests(): void {
  inFlight = null;
  memberThisPage = null;
}
