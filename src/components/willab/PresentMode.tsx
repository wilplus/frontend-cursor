"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
      }),
    [pageCount, pieces, presentationRef, slideTitles, text]
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
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
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || slides.length < 2) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.slideIndex);
        if (Number.isFinite(index)) setActiveSlide(index);
      },
      { root, threshold: [0.2, 0.55, 0.85] }
    );
    root.querySelectorAll<HTMLElement>("[data-slide-index]").forEach((node) =>
      observer.observe(node)
    );
    return () => observer.disconnect();
  }, [slides.length]);

  // Fullscreen. Nothing behind it, nothing over it but the X.
  return (
    <div
      data-ideal-text-wheel-native
      className="fixed inset-0 z-50 bg-background"
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
          className="absolute right-4 top-4 z-10 border-border/60 bg-background/80 backdrop-blur"
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

              {/* One roadmap layer: exactly one root per paragraph. Orange is
                  reserved for an accepted flagship; fallback roots stay
                  neutral even when no orange anchors exist. */}
              <div className="flex flex-col gap-3 py-1">
                {buildRootPhraseLayer(
                  slide.rows.map((row) => ({
                    key: row.key,
                    rootPhrase: row.rootPhrase,
                    rootType: row.rootType,
                  })),
                ).map((root) => (
                  <p
                    key={`root-${root.key}`}
                    className={
                      root.type === "flagship"
                        ? "text-[clamp(1.55rem,4vw,2.25rem)] font-semibold leading-tight text-primary"
                        : "text-[clamp(1.55rem,4vw,2.25rem)] font-medium leading-tight text-muted-foreground"
                    }
                  >
                    {root.text}
                  </p>
                ))}
              </div>

              {/* The normal Ideal Text is the only detailed text layer. Its
                  accepted span remains orange in place; there is no separate
                  duplicated flagship sentence. */}
              <div className="flex flex-col gap-5 text-[17px] leading-[1.7] text-foreground">
                {slide.rows.map((row) => (
                  <p key={`text-${row.key}`}>
                    <RichText text={row.idealText} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {!exportFormat && slides.length > 1 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 rounded-full bg-background/75 px-2 py-3 backdrop-blur"
        >
          {slides.map((slide, index) => (
            <span
              key={slide.key}
              className={
                index === activeSlide
                  ? "h-5 w-1.5 rounded-full bg-primary"
                  : "h-1.5 w-1.5 rounded-full bg-border"
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
