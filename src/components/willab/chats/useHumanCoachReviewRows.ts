"use client";

import { useEffect, useMemo, useState } from "react";
import { readCoachReviewHistory, type ReviewStatus } from "@/services/api/humanCoach";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { TrainingArc } from "@/services/api/trainings";
import { COACH_REVIEW_CHANGED } from "./HumanCoachHandoff";

export function useHumanCoachReviewRows(project: TrainingArc, signedIn: boolean): LoungeMessage[] {
  const id = project.arcId;
  const [snapshot, setSnapshot] = useState<{ project: string; rows: ReviewStatus[] } | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    let serial = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function load() {
      const request = ++serial;
      clearTimeout(timer);
      void readCoachReviewHistory(id).then(({ reviews }) => {
        if (!active || request !== serial) return;
        setSnapshot({ project: id, rows: reviews });
        if (reviews.some((review) => !review.feedback_at)) timer = setTimeout(load, 30_000);
      }, () => {
        if (active && request === serial) timer = setTimeout(load, 60_000);
      });
    }
    const changed = (event: Event) => { if ((event as CustomEvent).detail === id) load(); };
    load();
    window.addEventListener(COACH_REVIEW_CHANGED, changed);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener(COACH_REVIEW_CHANGED, changed);
      window.removeEventListener("focus", load);
    };
  }, [id, signedIn]);

  return useMemo(() => {
    if (!signedIn || snapshot?.project !== id) return [];
    return snapshot.rows.flatMap((review) => reviewRows(review, project));
  }, [id, project, signedIn, snapshot]);
}

function reviewRows(review: ReviewStatus, project: TrainingArc): LoungeMessage[] {
  const take = project.takes.find((item) => item.sessionId === review.take_session_id);
  const label = take ? "Take " + take.takeIndex : "Take";
  const row = (suffix: string, at: string, body: string, author?: string): LoungeMessage => ({
    client_id: review.id + suffix,
    client_created_at: at,
    role: "bot",
    kind: "text",
    body,
    metadata: {
      arc_id: project.arcId, project_chat: true, take_exchange: false, human_coach_author: author,
    },
  });
  const rows: LoungeMessage[] = [];
  if (review.email_sent_at) rows.push(row("-sent", review.email_sent_at, label + " sent to Artur."));
  if (review.feedback_at && review.feedback) rows.push(row("-reply", review.feedback_at, review.feedback, "Artur"));
  return rows;
}
