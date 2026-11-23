"use client";

import { ChevronRight, MessagesSquare } from "lucide-react";
import type { TrainingTake } from "@/services/api/trainings";

export const readyForReview = (take: TrainingTake) => take.reviewAvailable ?? take.feedbackAvailable;

export default function TakeReviewMessage({ take, count, preview, onOpen }: {
  take: TrainingTake;
  count: number;
  preview: string | null;
  onOpen: () => void;
}) {
  return <button type="button" data-take-review-message aria-expanded={false}
    className="grid w-fit max-w-[min(100%,345px)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[18px] bg-muted px-3 py-2.5 text-left hover:bg-accent"
    onClick={onOpen}>
    <span className="grid size-8 place-items-center rounded-lg border border-border bg-background text-accent-foreground">
      <MessagesSquare className="size-4" aria-hidden />
    </span>
    <span className="min-w-0">
      <span className="block text-[15px] font-semibold">Take {take.takeIndex} · Feedback walk</span>
      <span className="line-clamp-2 break-words text-[13px] text-muted-foreground">
        {preview || "Feedback · Practise · Ideal text"}
      </span>
      {count ? <span className="block text-xs text-muted-foreground">{count} practice {count === 1 ? "run" : "runs"}</span> : null}
    </span>
    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
  </button>;
}
