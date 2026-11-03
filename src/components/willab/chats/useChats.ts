"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRingState } from "@/hooks/useRingState";
import { getChats, type Chat } from "@/services/api/chats";
import { takeChats } from "@/services/api/bootPrefetch";

/** The ring feature behind the chats between users (ring 6: the founder). */
export const CHATS_FEATURE = "chats";

/** Whether the chats are on for the signed-in person: the backend's ring
 *  decision (`features_on` of GET /v2/user/rings, read once per page load),
 *  as the tempo step reads its own. Off while that read is in flight or has
 *  failed, so /chat is then the Lounge as it is. */
export function useChatsOn(): boolean {
  return useChatsDecided() === true;
}

/** The same decision, `null` while the rings read is still in flight. */
export function useChatsDecided(): boolean | null {
  const ring = useRingState();
  return ring === null ? null : ring.featuresOn.has(CHATS_FEATURE);
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
