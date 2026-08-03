import { markerTokenSpans } from "@/lib/willab/richMarkers";
import type { IdealPiece, IdealSegment } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  pieceBadges — the discernment layer's PURE logic (founder 2026-07-20).     */
/*  Kept out of the component so it stays unit-testable: paragraph zipping is  */
/*  what decides whether badges may render at all, and document-level segment  */
/*  slicing is what keeps the star lanes untouched by the badge layer.         */
/* -------------------------------------------------------------------------- */

export interface ParagraphSpan {
  text: string;
  /** [start, end) of the paragraph inside the full text. */
  start: number;
  end: number;
}

/** Split into paragraphs on blank lines, refusing any split point that falls
 *  inside a rich-marker token (a fold marker may legally contain a blank
 *  line; slicing it would leak raw syntax). A refused split merges the two
 *  paragraphs, the count then mismatches the pieces, and the badges hide —
 *  the safe degrade. Pure. */
export function splitBadgeParagraphSpans(text: string): ParagraphSpan[] {
  if (!text) return [];
  const tokens = markerTokenSpans(text);
  const inToken = (i: number) => tokens.some(([ts, te]) => i > ts && i < te);
  const parts: ParagraphSpan[] = [];
  const re = /\n{2,}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (inToken(m.index) || inToken(m.index + m[0].length)) continue;
    parts.push({ text: text.slice(last, m.index), start: last, end: m.index });
    last = m.index + m[0].length;
  }
  parts.push({ text: text.slice(last), start: last, end: text.length });
  return parts.filter((p) => p.text.trim().length > 0);
}

/** The paragraph texts alone (the original split API, kept for tests). */
export function splitBadgeParagraphs(text: string): string[] {
  return splitBadgeParagraphSpans(text).map((p) => p.text);
}

/** Distribute ONE document-level segmentation across the paragraphs, so an
 *  anchor keeps its single first-occurrence-in-document match instead of
 *  re-matching in every paragraph it textually appears in (which would
 *  duplicate stars and paint approved folds in the wrong paragraph).
 *
 *  Segments are contiguous over the full text; plain segments are sliced at
 *  paragraph boundaries (the "\n\n" separators fall away with the slicing).
 *  A STYLED segment (bold / moment) straddling a boundary cannot be sliced
 *  faithfully → null, and the caller falls back to the un-badged single-pass
 *  view. Pure. */
export function sliceSegmentsByParagraphs(
  segments: IdealSegment[],
  spans: ParagraphSpan[]
): IdealSegment[][] | null {
  const out: IdealSegment[][] = spans.map(() => []);
  let cursor = 0;
  for (const seg of segments) {
    const s = cursor;
    const e = cursor + seg.text.length;
    cursor = e;
    for (let i = 0; i < spans.length; i++) {
      const os = Math.max(s, spans[i].start);
      const oe = Math.min(e, spans[i].end);
      if (oe <= os) continue;
      if (seg.bold || seg.moment) {
        if (s < spans[i].start || e > spans[i].end) return null;
        out[i].push(seg);
      } else {
        out[i].push({ text: seg.text.slice(os - s, oe - s) });
      }
    }
  }
  return out;
}

/** Which deck PDF page sits above each paragraph of the reading view, or null
 *  for no slides at all. Two provable mappings, nothing else (founder
 *  2026-08-03 — "we don't know to which slide this text is" must never be
 *  answered with a guess):
 *
 *   1. Every piece carries a BE-served slide_index in range → use them
 *      verbatim (pieces zip with paragraphs in slot order, the badge rule).
 *   2. Otherwise, the paragraph count EXACTLY equals the PDF's page count →
 *      paragraph i = page i (the BE assembles a deck arc's master text as one
 *      piece per slide, joined "\n\n" in slide order).
 *
 *  Any mismatch — a user edit that reshaped paragraphs, a lagging piece row,
 *  a deck longer or shorter than the document — hides the slides entirely
 *  rather than attach text to the wrong slide. Pure. */
export function slidePagesForParagraphs(
  paragraphCount: number,
  pieces: Pick<IdealPiece, "slideIndex">[] | null,
  pageCount: number | null
): number[] | null {
  if (pageCount === null || pageCount <= 0 || paragraphCount <= 0) return null;
  if (pieces && pieces.length === paragraphCount) {
    const idx = pieces.map((p) =>
      typeof p.slideIndex === "number" && Number.isFinite(p.slideIndex)
        ? p.slideIndex
        : null
    );
    if (idx.every((n): n is number => n !== null)) {
      return idx.every((n) => n >= 0 && n < pageCount) ? idx : null;
    }
  }
  return pageCount === paragraphCount
    ? Array.from({ length: paragraphCount }, (_, i) => i)
    : null;
}

/** The arc's newest take across every piece (incumbents AND challengers) —
 *  a piece from this take wears the tinted "fresh" pill. Pure. */
export function latestTakeIndex(pieces: IdealPiece[]): number | null {
  let max: number | null = null;
  for (const p of pieces) {
    for (const t of [p.takeIndex, p.challenger?.takeIndex ?? null]) {
      if (t !== null && (max === null || t > max)) max = t;
    }
  }
  return max;
}
