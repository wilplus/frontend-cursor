"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRingState } from "@/hooks/useRingState";
import { getChats, seedDemoChats, type Chat } from "@/services/api/chats";

/** The ring feature behind the chats between users (ring 6: the founder). */
export const CHATS_FEATURE = "chats";

/** Whether the chats are on for the signed-in person: the backend's ring
 *  decision (`features_on` of GET /v2/user/rings, read once per page load),
 *  as the tempo step reads its own. Off while that read is in flight or has
 *  failed, so /chat is then the Lounge as it is. */
export function useChatsOn(): boolean {
  return useRingState()?.featuresOn.has(CHATS_FEATURE) === true;
}

/** The person's chats, read while `on`; `null` until the first read lands.
 *  An empty list asks once for the two demo chats (the founder's test
 *  account sees the demo). A failed read is an empty list. */
export function useChatList(on: boolean): { chats: Chat[] | null; reload: () => void } {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const seeded = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    let list = await getChats();
    if (list !== null && list.length === 0 && !seeded.current) {
      seeded.current = true;
      list = await seedDemoChats();
    }
    if (alive.current) setChats(list ?? []);
  }, []);
  useEffect(() => {
    if (on) void load();
  }, [on, load]);
  return { chats, reload: () => void load() };
}
