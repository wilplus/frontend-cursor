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
    if (on) void load();
  }, [on, load]);
  return { chats, reload: () => void load() };
}
