import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";
import {
  slidePagesForParagraphs,
  splitBadgeParagraphSpans,
} from "@/lib/willab/pieceBadges";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import type { IdealPiece } from "@/services/api/idealText";

export type PresentationExportFormat = "pdf" | "docx";

export interface PresentationDocumentRow {
  key: number;
  rootPhrase: string;
  rootType: "flagship" | "neutral";
  idealText: string;
}

export interface PresentationDocumentSlide {
  key: string;
  /** Zero-based page in the uploaded PDF. null means a deckless mock slide. */
  page: number | null;
  title: string;
  body: string;
  /** Canonical deckless artwork; null for uploaded and unassigned content. */
  artworkSrc: string | null;
  rows: PresentationDocumentRow[];
  /** False only for unassigned Ideal Text that must not be guessed onto a slide. */
  hasVisual: boolean;
}

function neutralRoot(text: string): string {
  return stripRichMarkers(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
}

/**
 * The one projection used by Presentation Mode and every export adapter.
 *
 * It keeps the visual source authoritative: an uploaded project always owns
 * PDF-page slots, while a deckless project always owns the three canonical
 * mock slides. Ideal Text is attached only by a provable slide index; unknown
 * text remains readable in a separate, visual-free group rather than being
 * guessed onto the wrong slide.
 */
export function buildPresentationDocument({
  text,
  pieces,
  presentationRef,
  pageCount,
  slideTitles,
}: {
  text: string;
  pieces: IdealPiece[] | null;
  presentationRef: string | null;
  pageCount: number | null;
  slideTitles: string[] | null;
}): PresentationDocumentSlide[] {
  const paragraphs = splitBadgeParagraphSpans(text);
  const pieceByKey = new Map((pieces ?? []).map((piece) => [piece.pieceKey, piece]));
  const exactPages = presentationRef
    ? slidePagesForParagraphs(paragraphs.length, pieces, pageCount)
    : null;
  const rows = paragraphs.map((paragraph, index) => {
    const piece = pieceByKey.get(index) ?? null;
    const rawPage = exactPages?.[index] ?? piece?.slideIndex ?? null;
    const candidatePage =
      typeof rawPage === "number" && Number.isInteger(rawPage) && rawPage >= 0
        ? rawPage
        : null;
    const page =
      presentationRef &&
      candidatePage !== null &&
      pageCount !== null &&
      candidatePage >= pageCount
        ? null
        : candidatePage;
    return {
      page,
      value: {
        key: paragraph.start,
        rootPhrase: piece?.rootPhrase || neutralRoot(paragraph.text),
        rootType:
          piece?.rootType === "flagship"
            ? ("flagship" as const)
            : ("neutral" as const),
        idealText: paragraph.text,
      },
    };
  });

  if (presentationRef) {
    const largestKnownPage = rows.reduce(
      (largest, row) => (row.page === null ? largest : Math.max(largest, row.page)),
      -1
    );
    const count =
      pageCount !== null && pageCount > 0
        ? pageCount
        : Math.max(1, slideTitles?.length ?? 0, largestKnownPage + 1);
    const slides: PresentationDocumentSlide[] = Array.from(
      { length: count },
      (_, page) => ({
        key: `pdf-${page}`,
        page,
        title: slideTitles?.[page] || `Slide ${page + 1}`,
        body: "",
        artworkSrc: null,
        rows: [],
        hasVisual: true,
      })
    );
    for (const row of rows) {
      if (row.page !== null && row.page < slides.length) {
        slides[row.page].rows.push(row.value);
      }
    }
    const unassigned = rows.filter((row) => row.page === null).map((row) => row.value);
    if (unassigned.length > 0) {
      slides.push({
        key: "unassigned-text",
        page: null,
        title: "",
        body: "",
        artworkSrc: null,
        rows: unassigned,
        hasVisual: false,
      });
    }
    return slides;
  }

  const slides: PresentationDocumentSlide[] = DEFAULT_DECK.map((slide, page) => ({
    key: `mock-${page}`,
    page: null,
    title: slide.title,
    body: slide.body,
    artworkSrc: slide.artworkSrc ?? null,
    rows: [],
    hasVisual: true,
  }));
  const exactDecklessZip = paragraphs.length === DEFAULT_DECK.length;
  const unassigned: PresentationDocumentRow[] = [];
  rows.forEach((row, index) => {
    const page = row.page ?? (exactDecklessZip ? index : null);
    if (page !== null && page < slides.length) slides[page].rows.push(row.value);
    else unassigned.push(row.value);
  });
  if (unassigned.length > 0) {
    slides.push({
      key: "unassigned-text",
      page: null,
      title: "",
      body: "",
      artworkSrc: null,
      rows: unassigned,
      hasVisual: false,
    });
  }
  return slides;
}
