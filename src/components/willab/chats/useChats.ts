"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSignedIn } from "../useSignedIn";
import { getChats, type Chat } from "@/services/api/chats";
import { takeChats } from "@/services/api/bootPrefetch";
import { forgetChats, keepChats, keptChats, whoseChats } from "./chatsKept";

/** Whether the chats are on: for every signed-in person, everywhere
 *  (backend N456; was ring 6, feature `chats`). No ring is read. */
export function useChatsOn(): boolean {
  return useChatsDecided() === true;
}

/** The same, `null` while the session is still being read. */
export function useChatsDecided(): boolean | null {
  return useSignedIn();
}

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
    const who = await whoseChats();
    if (isFirst) {
      const kept = keptChats(who);
      if (kept && alive.current) setChats((now) => now ?? kept);
    }
    const list = await read;
    if (list) keepChats(who, list);
    if (alive.current) setChats((now) => list ?? now ?? []);
  }, []);
  useEffect(() => {
    if (on) void load();
  }, [on, load]);
  return { chats, reload: () => void load() };
}

/** Signed out, the list kept on this browser goes (chatsKept.ts). */
export function useForgetChatsSignedOut(decided: boolean | null): void {
  useEffect(() => {
    if (decided === false) forgetChats();
  }, [decided]);
}
