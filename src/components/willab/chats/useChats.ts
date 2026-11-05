"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSignedIn } from "../useSignedIn";
import { getChats, type Chat } from "@/services/api/chats";
import { takeChats } from "@/services/api/bootPrefetch";
import { forgetChats, keepChats, keptChats, whoseChats } from "./chatsKept";
import { getInquiries, type Inquiry } from "@/services/api/takeMatches";

/** An asking chat in the list (backend N485): its own row, under its
 *  pseudonym until Open Take, then the asker's name. */
function inquiryChat(inquiry: Inquiry): Chat {
  return {
    id: `inquiry:${inquiry.id}`,
    kind: "team",
    title: inquiry.state === "new" ? inquiry.pseudonym : inquiry.name || inquiry.pseudonym,
    subtitle: inquiry.role ?? "",
    last: null,
    inquiry,
  };
}

/** Whether the chats are on: for every signed-in person, everywhere
 *  (backend N456; was ring 6, feature `chats`). No ring is read. */
export function useChatsOn(): boolean {
  return useChatsDecided() === true;
}

/** The same, `null` while the session is still being read. */
export function useChatsDecided(): boolean | null {
  return useSignedIn();
}

/** How often the open list reads the chats again (N500). */
const READ_AGAIN_MS = 20_000;

/** The person's chats, read while `on`; `null` until the first list is known.
 *  An empty list stays empty: no demo chats for a newcomer (backend N401;
 *  was: two demo chats the first time). The first read takes the one the
 *  chat boot already started (bootPrefetch.ts); until it lands, the list this
 *  browser last read for this person draws at once (chatsKept.ts). A failed
 *  read keeps the list there is, or is an empty list when there is none. */
export function useChatList(on: boolean): { chats: Chat[] | null; reload: () => void } {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const first = useRef(true);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    const isFirst = first.current;
    first.current = false;
    const read = (isFirst ? takeChats : getChats)();
    const asking = getInquiries();
    const who = await whoseChats();
    if (isFirst) {
      const kept = keptChats(who);
      if (kept && alive.current) setChats((now) => now ?? kept);
    }
    const [list, inquiries] = await Promise.all([read, asking]);
    const askingRows = inquiries.map(inquiryChat);
    if (list) {
      const shown = [...askingRows, ...list];
      keepChats(who, shown);
      if (alive.current) setChats(shown);
    } else if (alive.current) {
      setChats((now) => now ?? askingRows);
    }
  }, []);
  useEffect(() => {
    if (!on) return;
    void load();
    // Read again while the list is open and on coming back to it, so a
    // message that arrives while you look shows as new (N500).
    const again = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(again, READ_AGAIN_MS);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
    };
  }, [on, load]);
  return { chats, reload: () => void load() };
}

/** Signed out, the list kept on this browser goes (chatsKept.ts). */
export function useForgetChatsSignedOut(decided: boolean | null): void {
  useEffect(() => {
    if (decided === false) forgetChats();
  }, [decided]);
}
