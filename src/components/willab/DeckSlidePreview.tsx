"use client";

import { useEffect, useState } from "react";
import { PdfPage } from "@/components/willab/pdfSlides";

/** One slide's picture on the Ideal Text deck, with a way back from a failure.
 *
 *  REPORTED FROM REAL USE 2026-09-16: "slide preview is unavailable again".
 *
 *  The deck rendered `PdfPage` raw, with `onError={() => undefined}` — the
 *  failure was caught and then dropped on the floor. One unlucky fetch (a
 *  phone changing networks, a cold edge, a policy refusing the host) and the
 *  slide stayed a grey bar until the whole document was reloaded, with no
 *  control to try again and nothing said about what was missing.
 *
 *  The recording stage has had the way back since #360: `SlideRender` keeps
 *  its own `pdfFailed` and offers "Retry loading slides", which really
 *  re-fetches because `loadPdf` evicts a failed promise from its cache. This
 *  surface never got it, which is why the same symptom read as new.
 *
 *  IT IS THE SAME TREATMENT, not a second one: the same state, the same
 *  eviction, the same founder-approved label. It is a separate component only
 *  because the deck is a loop over slides — the failure and its retry belong
 *  to ONE slide, and the deck should not grow a map of them.
 *
 *  A transcript is never substituted for a slide (the rule `SlideRender`
 *  states): what the speaker said while a slide was up is not a picture of
 *  that slide. The absence stays explicit, and now it is recoverable.
 */
export default function DeckSlidePreview({
  presentationRef,
  pageIndex,
  className = "mt-3",
}: {
  presentationRef: string;
  pageIndex: number;
  /** The outer spacing, which differs between the deck and the slide editor.
   *  Only the margin — the frame belongs to this component, so both callers
   *  fail the same way. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  // A new deck source, or a different page, gets a fresh chance.
  useEffect(() => setFailed(false), [presentationRef, pageIndex]);

  if (!failed) {
    return (
      <div
        className={`${className} overflow-hidden rounded-xl border border-border bg-muted`}
      >
        <PdfPage
          url={presentationRef}
          pageIndex={pageIndex}
          onError={() => setFailed(true)}
          className="w-full"
        />
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-muted text-[13px] text-muted-foreground">
        Slide preview unavailable
      </div>
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={() => setFailed(false)}
          className="min-h-[44px] rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          Retry loading slides
        </button>
      </div>
    </div>
  );
}
