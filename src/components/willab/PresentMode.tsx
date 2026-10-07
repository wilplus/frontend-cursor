"use client";

import { useMemo, useRef, useState } from "react";
import {
  MockPresentationSlide,
  PdfPage,
  useDeckPageCount,
} from "./pdfSlides";
import { RichText } from "./RichText";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import type { IdealPiece } from "@/services/api/idealText";
import {
  buildPresentationDocument,
  type PresentationExportFormat,
} from "@/lib/willab/presentationDocument";
import { buildRootPhraseLayer } from "@/lib/willab/rootPhraseLayer";
import { helperWordRanges } from "@/lib/willab/answeredBookmark";

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
/*  arrows, no page counter, no header, no progress, no slide-dot rail (Q-B14  */
/*  A (2), 2026-10-07). One X, floating, on a dark screen.                     */
/*                                                                            */
/*  READ-ONLY BY CONSTRUCTION. This does NOT record. The take pipeline is      */
/*  untouched and stays in the Lab panel, where advancing a slide is a TAP     */
/*  that stamps a real timestamp into the tap timeline — that timeline is how  */
/*  every spoken word gets bucketed to the slide that was on screen (F1 piece  */
/*  (a), the two-clocks boundary). Scroll position is continuous and jittery   */
/*  and would make a far worse clock, so the two surfaces stay separate: this  */
/*  one is for delivering, the Lab is for capturing.                          */
/*                                                                            */
/*  The visual source is authoritative: uploaded projects show PDF pages and   */
/*  never substitute extracted text in the slide slot; deckless projects show  */
/*  the canonical three-slide mock.                                            */
/* -------------------------------------------------------------------------- */

export default function PresentMode({
  text,
  pieces,
  presentationRef,
  slideTitles = null,
  onClose,
  exportFormat = null,
  headlines = null,
}: {
  /** The served ideal text, marker syntax and all. */
  text: string;
  /** Per-paragraph provenance; carries slideIndex when the BE serves it. */
  pieces: IdealPiece[] | null;
  /** The arc's deck PDF. null → the canonical three-slide mock deck. */
  presentationRef: string | null;
  slideTitles?: string[] | null;
  onClose: () => void;
  /** Export preview has only X + one format-specific Download action. */
  exportFormat?: PresentationExportFormat | null;
  /** The page's helper words by part id (Phase 5), so Slide-saved words
   *  reach the delivery and the export too. */
  headlines?: ReadonlyMap<string, string> | null;
}) {
  // The device Back gesture exits present mode rather than the whole app —
  // same LIFO contract every willab overlay follows.
  useBackDismiss(onClose);

  const pageCount = useDeckPageCount(presentationRef);
  const slides = useMemo(
    () =>
      buildPresentationDocument({
        text,
        pieces,
        presentationRef,
        pageCount,
        slideTitles,
        headlines,
      }),
    [headlines, pageCount, pieces, presentationRef, slideTitles, text]
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const deckStillLoading = Boolean(presentationRef && pageCount === null);
  const download = async () => {
    if (downloading || deckStillLoading || !exportFormat) return;
    setDownloading(true);
    setDownloadFailed(false);
    try {
      if (exportFormat === "pdf") {
        const { downloadPresentationPdf } = await import(
          "@/lib/willab/presentationPdf"
        );
        await downloadPresentationPdf({ presentationRef, slides });
      } else {
        const { downloadPresentationDocx } = await import(
          "@/lib/willab/presentationDocx"
        );
        await downloadPresentationDocx({ presentationRef, slides });
      }
    } catch {
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  // Fullscreen. Nothing behind it, nothing over it but the X. DARK, as the
  // Final Screens' L5 frame draws it (founder 2026-10-07, Q-B14 A (2); build
  // plan D-IT-9): the `dark` theme on this one root, so every token on it
  // (the page, the words, the X) reads on the dark surface; and no slide-dot
  // rail.
  return (
    <div
      data-ideal-text-wheel-native
      data-present-mode
      className="dark fixed inset-0 z-50 bg-background text-foreground"
    >
      {exportFormat ? (
        <div className="print:hidden absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => void download()}
            disabled={downloading || deckStillLoading}
            className="h-9 rounded-full bg-foreground px-4 text-[13px] font-medium text-background"
          >
            {deckStillLoading
              ? "Loading slides…"
              : downloading
              ? "Preparing…"
              : downloadFailed
              ? "Couldn’t export — try again"
              : `Download ${exportFormat.toUpperCase()}`}
          </button>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close export preview" />
        </div>
      ) : (
        <OverlayCloseButton
          onClick={onClose}
          ariaLabel="Exit present mode"
          // Placed only: the app's one X, unchanged (Q-B14 A (1), D-RC-6).
          className="absolute right-4 top-4 z-10"
        />
      )}

      {/* The scroll. Google-Docs style: slide, words, slide, words. */}
      <div
        ref={scrollRef}
        className="scrollbar-none h-full overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 pb-24 pt-16 print:max-w-none print:px-0 print:pt-0">
          {slides.map((slide, slideIndex) => (
            <section
              key={slide.key}
              data-slide-index={slideIndex}
              className="flex min-h-[70vh] flex-col gap-5"
            >
              {presentationRef && slide.hasVisual && slide.page !== null ? (
                <div className="aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                  <PdfPage
                    url={presentationRef}
                    pageIndex={slide.page}
                    className="h-full w-full"
                    fit
                  />
                </div>
              ) : !presentationRef && slide.hasVisual ? (
                <div className="aspect-video overflow-hidden rounded-xl">
                  {slide.artworkSrc ? (
                    <MockPresentationSlide
                      artworkSrc={slide.artworkSrc}
                      title={slide.title}
                      body={slide.body}
                    />
                  ) : null}
                </div>
              ) : null}

              {/* HELPER WORDS OVER THEIR OWN PARAGRAPH (founder 2026-09-26,
                  the same rule as the Ideal Text): a bold orange headline
                  directly above the paragraph they came from, and the same
                  words italic — never orange — inside the running text. Only
                  locked flagship phrases; no root means no headline. The
                  paragraphs run 17px on a phone rising to 20px, as the page
                  does (founder 2026-09-30, "D"; D-IT-9). */}
              <div
                data-present-text
                className="flex flex-col gap-5 text-[17px] leading-[1.7] text-foreground md:text-[20px]"
              >
                {slide.rows.map((row) => {
                  const root = buildRootPhraseLayer(
                    [{ key: row.key, rootPhrase: row.rootPhrase, rootType: row.rootType }],
                    { includeNeutral: false },
                  )[0];
                  return (
                    <div key={`text-${row.key}`} className="flex flex-col gap-1">
                      {root ? (
                        <p
                          data-present-headline
                          className="text-[clamp(1.45rem,1.1rem+1.3vw,2.15rem)] font-bold leading-snug text-primary"
                        >
                          {root.text}
                        </p>
                      ) : null}
                      <p>
                        <RichText
                          text={row.idealText}
                          accent={false}
                          tint={helperWordRanges(row.idealText, root?.text)}
                          tintClass="italic"
                        />
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

    </div>
  );
}
