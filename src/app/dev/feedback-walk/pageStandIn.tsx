"use client";

import { cn } from "@/lib/utils";
import { aiGeneratedLabel } from "@/lib/willab/aiGeneratedMark";
import { WalkLink, WalkPill } from "@/components/willab/walk/WalkFooter";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import { MOMENTS, PAGE_WORDS, PARAGRAPHS, PROJECT_TITLE, SLIDE_LABEL, TAKE_SHOWN } from "./walkFixtures";

/* The Ideal Text page under the walk's overlay, for the dev harness's still
   screens and its live entry (?live=1). DEV ONLY. */

/** The Ideal Text page under the overlay (a still stand-in). */
export default function PageStandIn({
  answers,
  onReview,
}: {
  answers: Record<number, ConfidenceRatingValue>;
  onReview: () => void;
}) {
  const bar = (i: number) => {
    const a = answers[i];
    if (a === "yes" || a === "in_between") return "bg-affirm";
    if (a || MOMENTS[i]?.clearer || MOMENTS[i]?.exercise) return "bg-primary";
    return "bg-transparent";
  };
  return (
    <main data-testid="walk-page" className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex flex-col px-5 pb-2.5 pt-3">
        <b className="text-[17.5px] font-semibold">{PROJECT_TITLE}</b>
        <small className="text-[12px] text-muted-foreground">{aiGeneratedLabel("ideal-text", TAKE_SHOWN)}</small>
      </header>
      <div className="flex flex-1 flex-col gap-5 pb-2 pl-[34px] pr-[22px] pt-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{SLIDE_LABEL}</span>
        {PARAGRAPHS.map((p, i) => (
          <p key={i} className="relative m-0 text-[17px] leading-[1.65]">
            <span aria-hidden className={cn("absolute -left-[13px] bottom-0.5 top-0.5 w-[3px] rounded-full", bar(i))} />
            {p}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-1 px-5 pb-[30px] pt-2.5">
        <WalkPill action={{ label: PAGE_WORDS.reviewFeedback, onClick: onReview, testId: "walk-review" }} />
        <WalkLink action={{ label: PAGE_WORDS.recordTake(TAKE_SHOWN + 1), onClick: () => undefined }} />
      </div>
    </main>
  );
}
