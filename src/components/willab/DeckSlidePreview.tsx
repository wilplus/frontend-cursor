"use client";

import { useEffect, useState } from "react";
import { PdfPage } from "@/components/willab/pdfSlides";

/** One slide's picture on the Ideal Text deck.
 *
 *  IT IS BOUNDED (founder 2026-09-17: "on the desktop it covers the whole
 *  screen and the text is not visible"). `PdfPage` renders the page at its
 *  container's width, so on a phone it landed at 470x663 and on a desktop at
 *  1518x2144 — two and a half viewports tall, with the speaker's own words
 *  pushed off the bottom of the screen. The deck is a reading surface; the
 *  slide is context for the words, and context that buries them is worse than
 *  no context. `fit` + a bounded box letterboxes the page instead of letting
 *  it set the page height, so the words stay on screen at every width.
 *
 *  NO RETRY BUTTON (founder 2026-09-17: "it either works or it doesn't").
 *  One was added here earlier the same day and taken straight back out: a
 *  control that asks the speaker to do the app's job twice is not a recovery,
 *  it is an admission. The load still gets a fresh chance on its own whenever
 *  the deck or the page changes.
 *
 *  A transcript is never substituted for a slide (the rule `SlideRender`
 *  states): what the speaker said while a slide was up is not a picture of
 *  that slide. The absence stays explicit and stays small.
 */
export default function DeckSlidePreview({
  presentationRef,
  pageIndex,
  className = "mt-3",
}: {
  presentationRef: string;
  pageIndex: number;
  /** The outer spacing, which differs between the deck and the slide editor.
   *  Only the margin — the frame and the bound belong to this component, so
   *  both callers are held to the same size. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  // A new deck source, or a different page, gets a fresh chance.
  useEffect(() => setFailed(false), [presentationRef, pageIndex]);

  /* THE BOUND, in three parts that need each other.

     `aspect-video` is the shape a slide actually is. `max-h-[38vh]` is what
     stops a wide screen turning that shape into a full page of picture — the
     aspect alone is 854px tall on a desktop column. And `max-w-[67vh]` (38vh
     x 16/9) keeps the BOX 16:9 once the height is capped: without it the box
     stays column-wide and short, and a real slide letterboxes inside grey
     margins rather than filling it. mx-auto then centres what is left.

     On a phone the width cap is larger than the screen, so w-full wins and
     the slide is full-width as before. */
  const frame =
    "mx-auto aspect-video max-h-[38vh] w-full max-w-[67vh]" +
    " overflow-hidden rounded-xl border border-border bg-muted";

  if (failed) {
    return (
      <div className={className}>
        <div
          className={`${frame} flex items-center justify-center text-[13px] text-muted-foreground`}
        >
          Slide preview unavailable
        </div>
      </div>
    );
  }
  return (
    <div className={className}>
      <div className={frame}>
        <PdfPage
          url={presentationRef}
          pageIndex={pageIndex}
          onError={() => setFailed(true)}
          fit
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
