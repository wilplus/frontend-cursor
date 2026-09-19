"use client";

import { useEffect, useState } from "react";
import { MockPresentationSlide, PdfPage } from "@/components/willab/pdfSlides";
import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";

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
 *
 *  BOTH KINDS OF DECK, ONE TREATMENT (founder 2026-09-19: "when it's ideal
 *  text with the mock deck, the mock deck also shows up in the slides; when
 *  it's ideal text with my deck, it also shows up"). A deckless project owns
 *  the three canonical mock slides — Presentation Mode renders them and every
 *  export adapter draws them — and this surface alone showed nothing, so the
 *  same document read two different ways depending on whether a PDF had been
 *  uploaded. `DEFAULT_DECK` is not a placeholder: `defaultDeck.ts` calls it an
 *  F1 piece, because it is what makes 1:1 word→slide segmentation defined for
 *  a speaker who never uploaded anything. A slide that is real enough to
 *  record against is real enough to read against.
 *
 *  Unified HERE rather than at the two call sites, for the reason the frame
 *  is here: one component, one bound, and the deck and the slide editor both
 *  get it without either being able to drift.
 */
export default function DeckSlidePreview({
  presentationRef,
  pageIndex,
  className = "mt-3",
}: {
  /** The uploaded deck's PDF, or null for a deckless project — which falls to
   *  that page's canonical mock slide. */
  presentationRef: string | null;
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

  /* THE DECKLESS LANE. No PDF means the canonical mock slide for this page,
     in the same box at the same bound. A page the default deck does not have
     renders nothing at all rather than an apology: a deckless talk has three
     slides, and a fourth was never promised. */
  if (!presentationRef) {
    const slide = DEFAULT_DECK[pageIndex];
    if (!slide?.artworkSrc) return null;
    return (
      <div className={className}>
        <div className={frame}>
          <MockPresentationSlide
            artworkSrc={slide.artworkSrc}
            title={slide.title}
            body={slide.body}
          />
        </div>
      </div>
    );
  }

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
