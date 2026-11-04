import { bffFetch } from "@/lib/api/bffFetch";
import { createClient } from "@/lib/supabase/client";

/** By invitation (backend N471): whether the signed-in account may use the
 *  app, or is on the waitlist. Anything but a clear "not a member" lets the
 *  person through: an outage of this check never breaks the loop (CLAUDE.md,
 *  Never 3); the backend refuses a waiting account's work on its own.
 *
 *  A member stays a member (backend services/membership.py), so this browser
 *  remembers a member's account and answers at once next time: the chat page
 *  no longer waits on the network to open. A waiting account is never
 *  remembered, so it is asked every time and let in the moment it joins. */
export type Access = "member" | "waiting";

const REMEMBERED = "wl.member";

async function accountId(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function remembered(id: string | null): boolean {
  if (!id) return false;
  try {
    return window.localStorage.getItem(REMEMBERED) === id;
  } catch {
    return false;
  }
}

function remember(id: string | null): void {
  if (!id) return;
  try {
    window.localStorage.setItem(REMEMBERED, id);
  } catch {
    /* private window: ask again next time */
  }
}

/** The backend's answer; null when there was no clear one (an outage). */
async function ask(): Promise<Access | null> {
  try {
    const result = await bffFetch("/api/v2/me/access", { method: "GET", cache: "no-store" });
    if (result.kind !== "response" || !result.ok) return null;
    const body = result.body as { member?: unknown } | null;
    if (body?.member === false) return "waiting";
    return body?.member === true ? "member" : null;
  } catch {
    return null;
  }
}

export async function getAccess(): Promise<Access> {
  const id = await accountId();
  if (remembered(id)) return "member";
  const answer = await ask();
  if (answer === "member") remember(id);
  return answer ?? "member";
}
