"use client";

import { useEffect, useState } from "react";
import {
  SELF_MODELING_POST_SLUG,
  fetchPublishedJournalPost,
} from "@/services/api/journalPost";
import type { WalkJournalPost } from "./walk/WalkJudgementScreens";

/** The signed self-modeling post for "Judgement time!" (D-FW-18, JP1 A),
 *  read once while the walk is on; nothing is read while it is off. Null
 *  until it arrives and whenever it cannot be read: the walk then shows no
 *  link. */
export function useWalkJournalPost(on: boolean): WalkJournalPost | null {
  const [post, setPost] = useState<WalkJournalPost | null>(null);
  useEffect(() => {
    if (!on) return;
    let live = true;
    void fetchPublishedJournalPost(SELF_MODELING_POST_SLUG).then((read) => {
      if (live && read) setPost({ title: read.title, body: read.body });
    });
    return () => {
      live = false;
    };
  }, [on]);
  return post;
}
