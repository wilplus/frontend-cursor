"use client";

import { useEffect, useState } from "react";
import { PdfPage, TextSlide, useDeckPageCount } from "./pdfSlides";
import { RichText } from "./RichText";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import {
  slidePagesForParagraphs,
  splitBadgeParagraphSpans,
} from "@/lib/willab/pieceBadges";
import type { IdealPiece } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  PresentMode — the ideal text, fullscreen, for actually presenting it.      */
/*  Founder 2026-08-05.                                                        */
/*                                                                            */
/*  "when user clicks present mode, the screen is full, and there is only X    */
/*   to exit the screen and there are no arrows, nothing just the              */
/*   presentation; remember that we have the scrolling system like google      */
/*   doc, not clicking, but scroll through the slides to the text and the      */
/*   next slide"                                                              */
/*                                                                            */
/*  So: one continuous scroll — slide, its words, next slide, its words. No    */
/*  arrows, no page counter, no header, no progress. One X, floating.          */
/*                                                                            */
/*  READ-ONLY BY CONSTRUCTION. This does NOT record. The take pipeline is      */
/*  untouched and stays in the Lab panel, where advancing a slide is a TAP     */
/*  that stamps a real timestamp into the tap timeline — that timeline is how  */
/*  every spoken word gets bucketed to the slide that was on screen (F1 piece  */
/*  (a), the two-clocks boundary). Scroll position is continuous and jittery   */
/*  and would make a far worse clock, so the two surfaces stay separate: this  */
/*  one is for delivering, the Lab is for capturing.                          */
/*                                                                            */
/*  The text is the floor. A deck that fails to load leaves the words on       */
/*  screen and drops the images, never a broken-image placeholder — a person   */
/*  mid-presentation must never be handed an error card.                      */
/* -------------------------------------------------------------------------- */

export default function PresentMode({
  text,
  pieces,
  presentationRef,
  onClose,
}: {
  /** The served ideal text, marker syntax and all. */
  text: string;
  /** Per-paragraph provenance; carries slideIndex when the BE serves it. */
  pieces: IdealPiece[] | null;
  /** The arc's deck PDF. null → text-only present mode, which is still a
   *  perfectly good teleprompter. */
  presentationRef: string | null;
  onClose: () => void;
}) {
  // The device Back gesture exits present mode rather than the whole app —
  // same LIFO contract every willab overlay follows.
  useBackDismiss(onClose);

  // One failure hides EVERY slide (see the floor note above); a new deck
  // source earns a fresh attempt.
  const [deckFailed, setDeckFailed] = useState(false);
  useEffect(() => setDeckFailed(false), [presentationRef]);
  const deckUrl = presentationRef && !deckFailed ? presentationRef : null;
  const pageCount = useDeckPageCount(deckUrl);

  const paragraphs = splitBadgeParagraphSpans(text);
  // Only a PROVABLE paragraph↔slide mapping renders slides: the pieces' own
  // slideIndex, else an exact-count zip. A guessed pairing would put the
  // wrong slide over the wrong words, which is worse than no slides at all.
  const pages = deckUrl
    ? slidePagesForParagraphs(paragraphs.length, pieces, pageCount)
    : null;

  // Fullscreen. Nothing behind it, nothing over it but the X.
  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* The ONLY control. Floating over the scroll, always reachable. */}
      <OverlayCloseButton
        onClick={onClose}
        ariaLabel="Exit present mode"
        className="absolute right-4 top-4 z-10 border-border/60 bg-background/80 backdrop-blur"
      />

      {/* The scroll. Google-Docs style: slide, words, slide, words. */}
      <div className="scrollbar-none h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 pb-24 pt-16">
          {paragraphs.map((p, i) => (
            <section key={p.start} className="flex flex-col gap-4">
              {pages ? (
                <div className="overflow-hidden rounded-xl border border-border bg-muted">
                  <PdfPage
                    url={deckUrl!}
                    pageIndex={pages[i]}
                    onError={() => setDeckFailed(true)}
                    className="w-full"
                  />
                </div>
              ) : null}
              {/* Presenting size: bigger than the notebook, generous leading —
                  this is read standing up, at arm's length. Plain RichText, so
                  the marker emphasis survives but nothing is tappable: no
                  stars, no pills, no pickers. Just the words. (RichText owns
                  its own typography, so the size rides on the wrapper.) */}
              <div className="text-[19px] leading-[1.75] text-foreground">
                <RichText text={p.text} />
              </div>
            </section>
          ))}
          {/* A deckless arc still presents — the words alone. Nothing is said
              about the missing deck: mid-presentation is the worst possible
              moment to explain a data gap. */}
          {paragraphs.length === 0 ? (
            <TextSlide title="" body="" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
