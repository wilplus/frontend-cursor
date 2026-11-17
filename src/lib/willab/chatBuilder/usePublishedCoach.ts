"use client";

import { useEffect, useState } from "react";
import { readActiveCoach } from "@/services/api/chatBuilder";
import { readTalkDefinition, TALK_DRAFT_EVENT } from "./talkDraft";
import type { CoachDefinition } from "./types";

/** The coach this person is previewing. A talk draft on this device wins,
    and that path never calls the network. With no draft, the published
    coach is read, except in tests. Null is today's hardcoded walk. */
export function usePublishedCoach(): CoachDefinition | null {
  const [doc, setDoc] = useState<CoachDefinition | null>(null);
  useEffect(() => {
    let live = true;
    const pull = () => {
      const local = readTalkDefinition();
      if (local) {
        if (live) setDoc(local);
        return;
      }
      if (process.env.NODE_ENV === "test") {
        if (live) setDoc(null);
        return;
      }
      void readActiveCoach().then((got) => {
        if (live) setDoc(got);
      });
    };
    pull();
    window.addEventListener(TALK_DRAFT_EVENT, pull);
    return () => {
      live = false;
      window.removeEventListener(TALK_DRAFT_EVENT, pull);
    };
  }, []);
  return doc;
}
