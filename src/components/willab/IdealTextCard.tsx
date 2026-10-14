"use client";

import DeckSlidePreview from "./DeckSlidePreview";
import { useNewCoachFeedback } from "@/lib/willab/newCoachFeedback";

/* -------------------------------------------------------------------------- */
/*  IdealTextCard — a Take's one Ideal Text bubble in the chat (founder        */
/*  2026-10-14, walk first): the project's first slide, its name and the      */
/*  version tag ("2.0"), with the coach's "new" dot on the project's latest   */
/*  card. A tap opens the Ideal Text page on the text, from the top.          */
/* -------------------------------------------------------------------------- */

export default function IdealTextCard({
  title,
  version,
  slideRef,
  arcId = null,
  latest = false,
  onOpen,
  onOpenFeedback,
}: {
  title: string;
  /** The Take this text came from: the tag reads "N.0". */
  version: number | null;
  /** The project's deck (null: the default deck); undefined: not known, the plain tile. */
  slideRef?: string | null;
  /** With `latest`, the coach's "new" dot follows this project. */
  arcId?: string | null;
  latest?: boolean;
  onOpen: () => void;
  /** The coach's new feedback: its own bubble, opening the walk. */
  onOpenFeedback?: () => void;
}) {
  const fresh = useNewCoachFeedback(arcId);
  const card = { title, version, slideRef };
  return (
    <>
      <CardButton {...card} onOpen={onOpen} />
      {/* THE COACH'S FEEDBACK IS ITS OWN BUBBLE (founder 2026-10-14): the
          same card with the orange outline and the dot, opening the walk
          where the feedback is; the card above opens the text. */}
      {latest && fresh && onOpenFeedback ? <CardButton {...card} onOpen={onOpenFeedback} coach /> : null}
    </>
  );
}

function CardButton({
  title,
  version,
  slideRef,
  onOpen,
  coach = false,
}: {
  title: string;
  version: number | null;
  slideRef?: string | null;
  onOpen: () => void;
  coach?: boolean;
}) {
  return (
    <button
      type="button"
      data-review-card={coach ? undefined : true}
      data-coach-feedback-card={coach ? true : undefined}
      onClick={onOpen}
      className={`relative mr-auto flex w-[80%] max-w-sm items-center gap-2.5 rounded-[18px] border border-border bg-background p-2.5 pr-7 text-left transition-transform active:scale-[0.98]${coach ? " ring-2 ring-primary" : ""}`}
    >
      {coach ? (
        <span aria-hidden="true" data-testid="new-coach-feedback-dot" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
      ) : null}
      <span aria-hidden="true" className="aspect-video w-[72px] flex-none overflow-hidden rounded-md bg-gradient-to-br from-[#dde3ee] to-[#c7d0e0]">
        {slideRef !== undefined ? (
          // Drawn at 360px and shrunk to the 72px tile, so the slide keeps its own proportions.
          <span className="block w-[360px] origin-top-left scale-[0.2]">
            <DeckSlidePreview presentationRef={slideRef} pageIndex={0} className="" size="header" />
          </span>
        ) : null}
      </span>
      <b className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</b>
      {version !== null ? (
        <span className="flex-none rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-semibold">{`${version}.0`}</span>
      ) : null}
      <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-muted-foreground">
        ›
      </span>
    </button>
  );
}
