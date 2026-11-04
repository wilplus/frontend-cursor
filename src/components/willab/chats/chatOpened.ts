import type { Chat } from "@/services/api/chats";
import { timeOf } from "./chatTime";

/* -------------------------------------------------------------------------- */
/*  A new message in the list (backend N321, N322; rules:                      */
/*  docs/flows/customer-requests.md §1 C1): a chat is new when its last        */
/*  message is newer than the last time this person opened it on this device. */
/*  Kept per chat in localStorage. Storage that cannot be read or written     */
/*  (a private window, blocked site data) reads as "not new": the list never  */
/*  shouts about something it cannot know. No number, ever.                    */
/* -------------------------------------------------------------------------- */

const KEY = "willab.chats.opened.";

/** When this person last opened the chat, null when never; undefined when
 *  storage cannot be read. */
function readOpened(chatId: string): number | null | undefined {
  try {
    const raw = window.localStorage.getItem(KEY + chatId);
    return raw === null ? null : Number(raw);
  } catch {
    return undefined;
  }
}

/** Opened now, or at the newest message seen in it when that is later (the
 *  server's clock may run ahead of this device's, and a message of one's own
 *  is never new). Never moves back. */
export function markChatOpened(chatId: string, newestSeen: string | null = null): void {
  try {
    const before = Number(window.localStorage.getItem(KEY + chatId)) || 0;
    const at = Math.max(before, Date.now(), timeOf(newestSeen) ?? 0);
    window.localStorage.setItem(KEY + chatId, String(at));
  } catch {
    // Storage is off: the chat simply never reads as new.
  }
}

/** Is a message sent at `createdAt` newer than the last time this chat was
 *  opened on this device? */
export function isNewSince(chatId: string, createdAt: string | null | undefined): boolean {
  const last = timeOf(createdAt);
  if (last === null) return false;
  const opened = readOpened(chatId);
  if (opened === undefined || Number.isNaN(opened)) return false;
  return opened === null || last > opened;
}

/** New when the last message is the other person's, an emoji included, and
 *  came after the chat was last opened here; your own never is (N500). */
export function chatIsNew(chat: Chat): boolean {
  return chat.last?.mine !== true && isNewSince(chat.id, chat.last?.created_at);
}
