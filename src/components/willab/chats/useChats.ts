"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSignedIn } from "../useSignedIn";
import { getChats, type Chat } from "@/services/api/chats";
import { takeChats } from "@/services/api/bootPrefetch";
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

/** The person's chats, read while `on`; `null` until the first read lands.
 *  An empty list stays empty: no demo chats for a newcomer (backend N401;
 *  was: two demo chats the first time). A failed read is an empty list. The
 *  first read takes the one the chat boot already started (bootPrefetch.ts). */
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
    const read = first.current ? takeChats : getChats;
    first.current = false;
    const [list, asking] = await Promise.all([read(), getInquiries()]);
    if (alive.current) setChats([...asking.map(inquiryChat), ...(list ?? [])]);
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
