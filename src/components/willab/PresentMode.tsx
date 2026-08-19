"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PdfPage, TextSlide, useDeckPageCount } from "./pdfSlides";
import { RichText } from "./RichText";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import {
  slidePagesForParagraphs,
  splitBadgeParagraphSpans,
} from "@/lib/willab/pieceBadges";
import type { IdealPiece } from "@/services/api/idealText";
import { stripRichMarkers } from "@/lib/willab/richMarkers";

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
  slideTitles = null,
  onClose,
  exportMode = false,
}: {
  /** The served ideal text, marker syntax and all. */
  text: string;
  /** Per-paragraph provenance; carries slideIndex when the BE serves it. */
  pieces: IdealPiece[] | null;
  /** The arc's deck PDF. null → text-only present mode, which is still a
   *  perfectly good teleprompter. */
  presentationRef: string | null;
  slideTitles?: string[] | null;
  onClose: () => void;
  /** Export preview has only X + Download; presentation mode has only X. */
  exportMode?: boolean;
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

  const groups = useMemo(() => {
    const fallbackRoot = (value: string) =>
      stripRichMarkers(value).trim().split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
    const rows = paragraphs.map((paragraph, index) => {
      const piece = pieces?.find((candidate) => candidate.pieceKey === index) ?? null;
      return {
        paragraph,
        page: pages?.[index] ?? piece?.slideIndex ?? null,
        rootPhrase: piece?.rootPhrase || fallbackRoot(paragraph.text),
        rootType: piece?.rootType === "flagship" ? "flagship" as const : "neutral" as const,
      };
    });
    const result: Array<{ page: number | null; rows: typeof rows }> = [];
    for (const row of rows) {
      const previous = result[result.length - 1];
      // A real page groups all of that slide's paragraphs beneath one image.
      // Unknown linkage stays separate so we never join unrelated text.
      if (previous && row.page !== null && previous.page === row.page) {
        previous.rows.push(row);
      } else {
        result.push({ page: row.page, rows: [row] });
      }
    }
    return result;
  }, [paragraphs, pages, pieces]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { downloadPresentationPdf } = await import(
        "@/lib/willab/presentationPdf"
      );
      await downloadPresentationPdf({
        presentationRef: deckUrl,
        slides: groups.map((group, index) => ({
          page: group.page,
          title:
            group.page !== null
              ? slideTitles?.[group.page] || `Slide ${group.page + 1}`
              : `Slide ${index + 1}`,
          rows: group.rows.map((row) => ({
            rootPhrase: row.rootPhrase,
            rootType: row.rootType,
            idealText: row.paragraph.text,
          })),
        })),
      });
    } finally {
      setDownloading(false);
    }
  };
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || groups.length < 2) return;
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
  }, [groups.length]);

  // Fullscreen. Nothing behind it, nothing over it but the X.
  return (
    <div
      data-ideal-text-wheel-native
      className="fixed inset-0 z-50 bg-background"
    >
      {exportMode ? (
        <div className="print:hidden absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={downloading}
            className="h-9 rounded-full bg-foreground px-4 text-[13px] font-medium text-background"
          >
            {downloading ? "Preparing…" : "Download"}
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
          {groups.map((group, groupIndex) => (
            <section
              key={`${group.page ?? "unknown"}-${group.rows[0]?.paragraph.start ?? groupIndex}`}
              data-slide-index={groupIndex}
              className="flex min-h-[70vh] flex-col gap-5"
            >
              {deckUrl && group.page !== null ? (
                <div className="overflow-hidden rounded-xl border border-border bg-muted">
                  <PdfPage
                    url={deckUrl!}
                    pageIndex={group.page}
                    onError={() => setDeckFailed(true)}
                    className="w-full"
                  />
                </div>
              ) : group.page !== null ? (
                <div className="min-h-48 overflow-hidden rounded-xl">
                  <TextSlide
                    title={slideTitles?.[group.page] || `Slide ${group.page + 1}`}
                    body=""
                  />
                </div>
              ) : null}

              {/* One roadmap layer: exactly one root per paragraph. Orange is
                  reserved for an accepted flagship; fallback roots stay
                  neutral even when no orange anchors exist. */}
              <div className="flex flex-col gap-3 py-1">
                {group.rows.map((row) => (
                  <p
                    key={`root-${row.paragraph.start}`}
                    className={
                      row.rootType === "flagship"
                        ? "text-[clamp(1.55rem,4vw,2.25rem)] font-semibold leading-tight text-primary"
                        : "text-[clamp(1.55rem,4vw,2.25rem)] font-medium leading-tight text-muted-foreground"
                    }
                  >
                    {row.rootPhrase}
                  </p>
                ))}
              </div>

              {/* The normal Ideal Text is the only detailed text layer. Its
                  accepted span remains orange in place; there is no separate
                  duplicated flagship sentence. */}
              <div className="flex flex-col gap-5 text-[17px] leading-[1.7] text-foreground">
                {group.rows.map((row) => (
                  <p key={`text-${row.paragraph.start}`}>
                    <RichText text={row.paragraph.text} />
                  </p>
                ))}
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

      {!exportMode && groups.length > 1 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 rounded-full bg-background/75 px-2 py-3 backdrop-blur"
        >
          {groups.map((_, index) => (
            <span
              key={index}
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
