"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's way in: a row in the list of chats, right under Will (backend  */
/*  N521; was the Lounge bubble and the pinned Speakers button, B1).          */
/*                                                                            */
/*    name   the job in the person's own profile ("who they are", N518 item   */
/*           7); "Your queue" when they wrote none                           */
/*    line   "Open your queue" with the list's new look while someone waits  */
/*           (N500: bold, orange, the dot, no number); "Nobody is waiting    */
/*           for you." when nobody does; empty until the queue is read, so   */
/*           it never says "Nobody" before it knows (founder 2026-10-18)     */
/*    tap    the door, mounted in the Lounge underneath, opens Your queue    */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ChatListRow } from "../chats/ChatList";
import { getMyProfile } from "@/services/api/chats";
import { openCoachQueue, useCoachWaiting } from "@/lib/willab/coachDoor";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

/** The row's name and line. Pure. */
export function coachRowWords(role: string | null | undefined, waiting: number | null): { title: string; preview: string; isNew: boolean } {
  const title = role?.trim() || COPY.queueTitle;
  if (waiting === null) return { title, preview: "", isNew: false };
  return waiting > 0 ? { title, preview: COPY.bubbleOpen, isNew: true } : { title, preview: COPY.queueEmpty, isNew: false };
}

export default function CoachChatRow() {
  const waiting = useCoachWaiting();
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getMyProfile().then((profile) => {
      if (alive) setRole(profile?.role ?? null);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const words = coachRowWords(role, waiting);
  return (
    <ChatListRow
      id="coach"
      circle={
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Users className="h-5 w-5" strokeWidth={1.8} />
        </span>
      }
      title={words.title}
      preview={words.preview}
      isNew={words.isNew}
      onOpen={openCoachQueue}
    />
  );
}
