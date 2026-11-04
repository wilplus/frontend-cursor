"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSignedIn } from "../useSignedIn";
import { getChats, type Chat } from "@/services/api/chats";
import { takeChats } from "@/services/api/bootPrefetch";

/** Whether the chats are on: for every signed-in person, everywhere
 *  (backend N456; was ring 6, feature `chats`). No ring is read. */
export function useChatsOn(): boolean {
  return useChatsDecided() === true;
}

/** The same, `null` while the session is still being read. */
export function useChatsDecided(): boolean | null {
  return useSignedIn();
}

/** How often the open list reads the chats again (N499). */
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
    const list = await read();
    if (alive.current) setChats(list ?? []);
  }, []);
  useEffect(() => {
    if (!on) return;
    void load();
    // Read again while the list is open and on coming back to it, so a
    // message that arrives while you look shows as new (N499).
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
