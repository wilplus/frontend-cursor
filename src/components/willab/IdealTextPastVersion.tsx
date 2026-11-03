"use client";

import AiGeneratedNote from "./AiGeneratedNote";
import DeckSlideThumb from "./DeckSlideThumb";
import IdealTextHeading from "./IdealTextHeading";
import MarkedParagraphs from "./MarkedParagraphs";
import OverlayCloseButton from "./OverlayCloseButton";
import { kickerFor } from "./TranscriptReviewDeck";
import { useBackDismiss } from "./useBackDismiss";
import { WalkLink } from "./walk/WalkFooter";
import { aiGeneratedAttrs } from "@/lib/willab/aiGeneratedMark";
import { slideGroupsOf, type IdealTextPast } from "@/lib/willab/pastIdealText";
import type { IdealTextRevision } from "@/services/api/blockVariants";

/* -------------------------------------------------------------------------- */
/*  IdealTextPastVersion — an older Take's Ideal Text card, opened (founder    */
/*  2026-11-03, backend N375): the words that Take made, as they were then,    */
/*  read only, slide by slide on the deck that Take was said on. The newest    */
/*  card still opens the live page (rule 5: the Ideal Text is what the latest  */
/*  Take said; an old version is shown, never brought back). Read from the     */
/*  same versions as the History under ⋯.                                     */
/* -------------------------------------------------------------------------- */

export default function IdealTextPastVersion({
  revision,
  past,
  onClose,
}: {
  revision: IdealTextRevision;
  past: IdealTextPast;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const groups = slideGroupsOf(revision);
  const onSlides = groups.some((g) => g.slideIndex !== null);
  return (
    <div
      data-ideal-text-past
      {...aiGeneratedAttrs("ideal-text")}
      className="fixed inset-0 z-40 flex flex-col overscroll-none bg-background"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5">
        <div className="flex min-w-0 flex-col">
          <IdealTextHeading title={past.title} status={null} />
          <AiGeneratedNote
            kind="ideal-text"
            name={past.title}
            take={revision.takeIndex ?? (past.by === "take" ? past.n : null)}
          />
        </div>
        <OverlayCloseButton onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((g, i) => (
          // The live page's reading column and its compact slide row
          // (founder 2026-09-26 and 2026-09-28): the tile beside the kicker
          // on a phone, above it on a computer. Read only: no pencil.
          <section key={i} className="mx-auto flex w-full max-w-[56rem] flex-col gap-4 px-6 py-6 sm:px-10">
            {onSlides ? (
              <div className="flex shrink-0 items-center gap-3 md:flex-col md:gap-2">
                {g.slideIndex !== null ? (
                  <DeckSlideThumb
                    presentationRef={revision.presentationRef}
                    pageIndex={g.slideIndex}
                    label={kickerFor(g.slideIndex, null)}
                  />
                ) : null}
                <p className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:flex-none">
                  {kickerFor(g.slideIndex, null)}
                </p>
              </div>
            ) : null}
            <MarkedParagraphs text={g.text} textSizeClass="text-[18px]" />
          </section>
        ))}
      </div>
      <div className="shrink-0 bg-background px-4">
        <div className="mx-auto w-full max-w-3xl">
          <WalkLink action={{ label: "Close", onClick: onClose }} />
        </div>
      </div>
    </div>
  );
}
