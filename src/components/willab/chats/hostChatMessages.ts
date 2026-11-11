"use client";

import { useEffect, useState } from "react";
import { getChatThread, type ChatMessage } from "@/services/api/chats";

/* -------------------------------------------------------------------------- */
/*  A host's chat that takes Takes (backend N648 item 8) is drawn as the      */
/*  speaking chat for it; the chat's own messages (the host's answers, their */
/*  questions, one's own words to them) are drawn there too, each in its     */
/*  place by time among the Takes, so nothing of the chat is lost.            */
/* -------------------------------------------------------------------------- */

/** The tag of a Take made in this chat (backend #1961, `meta.made_here`):
 *  its Take is drawn by the Lounge's own rows. */
const madeHere = (m: ChatMessage) => !!m.meta && "made_here" in m.meta;

/** The chat's own messages while it is open, oldest first; none for no chat. */
export function useHostMessages(chatId: string | null): ChatMessage[] {
  const [messages, setMessages] = useState<{ chat: string; list: ChatMessage[] } | null>(null);
  useEffect(() => {
    if (!chatId) return;
    let alive = true;
    void getChatThread(chatId).then((thread) => {
      if (alive) setMessages({ chat: chatId, list: (thread?.messages ?? []).filter((m) => !madeHere(m)) });
    });
    return () => {
      alive = false;
    };
  }, [chatId]);
  return chatId && messages?.chat === chatId ? messages.list : [];
}

const at = (iso: string | null | undefined) => {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : 0;
};

/** The chat's messages laid among the Lounge's rows by time: `before[i]`
 *  goes right before row i, `after` after the last. Pure. */
export function hostRowsAround(
  host: readonly ChatMessage[],
  rowTimes: readonly (string | null | undefined)[],
): { before: ChatMessage[][]; after: ChatMessage[] } {
  const sorted = [...host].sort((a, b) => at(a.created_at) - at(b.created_at));
  const before: ChatMessage[][] = rowTimes.map(() => []);
  let k = 0;
  rowTimes.forEach((time, i) => {
    const t = at(time);
    while (k < sorted.length && at(sorted[k].created_at) <= t) before[i].push(sorted[k++]);
  });
  return { before, after: sorted.slice(k) };
}
