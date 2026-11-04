import { getAuthToken } from "@/lib/api/auth-client";
import type { Chat } from "@/services/api/chats";

/* -------------------------------------------------------------------------- */
/*  The list of chats as this browser last read it, so the list draws at once */
/*  on the next open while the fresh read is on its way (useChatList). One    */
/*  copy, for one person: it is kept with whose it is and read back for that  */
/*  person only, and it goes when nobody is signed in. Storage that cannot be */
/*  read or written is simply no copy: the list waits for the read as before. */
/* -------------------------------------------------------------------------- */

const KEY = "willab.chats.list";

/** The signed-in person's id, from their session's token; null signed out. */
export async function whoseChats(): Promise<string | null> {
  try {
    const token = await getAuthToken();
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

/** This person's list as last read here, or null. */
export function keptChats(who: string | null): Chat[] | null {
  if (!who || typeof window === "undefined") return null;
  try {
    const kept = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as { who?: unknown; chats?: unknown } | null;
    return kept && kept.who === who && Array.isArray(kept.chats) ? (kept.chats as Chat[]) : null;
  } catch {
    return null;
  }
}

/** Keep this person's list as just read. */
export function keepChats(who: string | null, chats: Chat[]): void {
  if (!who || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ who, chats }));
  } catch {
    // Storage is off or full: no copy, the next open waits for the read.
  }
}

/** Signed out: no list stays behind on this browser. */
export function forgetChats(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept.
  }
}
