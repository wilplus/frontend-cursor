"use client";

import { useCallback, useEffect, useState } from "react";
import { changeChatStructure, fetchChatStructure, type ChangeStructure, type ChatStructure } from "@/services/api/chatStructure";
import { useUserId } from "../useUserId";

const CHANGED = "willab:chat-structure";

export function useChatStructure() {
  const owner = useUserId();
  const [result, setResult] = useState<{ owner: string; layout: ChatStructure } | null>(null);
  useEffect(() => {
    if (!owner) return;
    let active = true;
    let updated = false;
    void fetchChatStructure().then((layout) => {
      if (active && !updated && layout) setResult({ owner, layout });
    }).catch(() => undefined);
    const receive = (event: Event) => {
      const update = (event as CustomEvent<{ owner: string; layout: ChatStructure }>).detail;
      if (update?.owner === owner) {
        updated = true;
        setResult(update);
      }
    };
    window.addEventListener(CHANGED, receive);
    return () => { active = false; window.removeEventListener(CHANGED, receive); };
  }, [owner]);
  const change = useCallback(async (action: ChangeStructure): Promise<boolean> => {
    if (!owner) return false;
    const layout = await changeChatStructure(action).catch(() => null);
    if (!layout) return false;
    setResult({ owner, layout });
    window.dispatchEvent(new CustomEvent(CHANGED, { detail: { owner, layout } }));
    return true;
  }, [owner]);
  return { layout: result && result.owner === owner ? result.layout : null, change };
}
