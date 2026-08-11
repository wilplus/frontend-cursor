import { splitBadgeParagraphSpans } from "./pieceBadges";
import { partsForDocument, type Part } from "./documentParts";

/* -------------------------------------------------------------------------- */
/*  deckChunks — the transcript review deck's chunk model (founder 2026-08-11, */
/*  Lovable spec §1–§2).                                                       */
/*                                                                            */
/*  A CHUNK is the unit the student decides on: it carries exactly one lock    */
/*  icon and exactly one status. In this codebase a chunk IS a part IS a       */
/*  \n\n paragraph — deliberately, because part identity is the wire contract  */
/*  the lock endpoint validates (`partsToText` joins parts on a blank line     */
/*  and the BE refuses a payload that does not join back to its document).     */
/*  A sub-paragraph grain would need a second identity system beside the one   */
/*  the locks already hang on; if the founder wants finer chunks, the          */
/*  compliant path is to physically split long paragraphs through the          */
/*  arranger (one splitter, one identity), not to fork the join contract.      */
/*                                                                            */
/*  STATUS is derived, never stored (Lovable §2):                              */
/*    locked   — the part's server-owned lock. Wins over everything: locked    */
/*               text is never re-underlined, even when a Confident-Voice      */
/*               "better version pending" rides it (that surfaces only in     */
/*               the modal).                                                   */
/*    waiting  — at least one UNDECIDED suggestion overlaps the chunk. The     */
/*               ONLY state that underlines (the founder's rule: underline is  */
/*               reserved for feedback-waiting, nothing else may use it).      */
/*    accepted — a decided-approved suggestion overlaps and the chunk is not   */
/*               locked in yet: the amber wash, no underline.                  */
/*    clean    — nothing pending, nothing accepted-unlocked.                   */
/*                                                                            */
/*  R4 alignment: a suggestion with status null is UNDECIDED — absence of a    */
/*  decision is pending, exactly the ground-truth rule the BE's decisions      */
/*  ledger follows. Coercing null to "not pending" would hide feedback.        */
/*                                                                            */
/*  Pure — no React, no fetch.                                                 */
/* -------------------------------------------------------------------------- */

export type ChunkStatus = "clean" | "waiting" | "accepted" | "locked";

/** The slice of a DocumentSuggestion this model needs — structural, so the
 *  real mapper type satisfies it and tests stay dependency-free. Spans index
 *  into the SAME served document the paragraph spans are cut from. */
export interface DeckSuggestionLite {
  id: string;
  start: number;
  end: number;
  status: "pending" | "approved" | "dismissed" | null;
}

export interface DeckChunk {
  /** Identity + the server-owned lock — the part the lock PUT addresses. */
  part: Part;
  /** Index in the render/parts split (the two are the same function over the
   *  same string, so this index addresses both). */
  paragraphIndex: number;
  /** Char span in the served document (untrimmed paragraph span, so
   *  suggestion offsets intersect it directly). */
  start: number;
  end: number;
  status: ChunkStatus;
  /** Undecided suggestions on this chunk — what the REVIEW modal opens on. */
  pendingIds: string[];
  /** Approved suggestions on this chunk — the accepted wash until lock-in. */
  approvedIds: string[];
}

/** Real overlap between a suggestion and a chunk span. Half-open on both
 *  sides: a suggestion that merely touches a boundary belongs to the chunk
 *  whose words it sits in, not its neighbour. (Zero-width spans are refused
 *  server-side and cannot reach here through the mapper's verify-or-drop.) */
function overlaps(s: DeckSuggestionLite, start: number, end: number): boolean {
  return s.start < end && s.end > start;
}

/** Build the deck's chunks for one served document.
 *
 *  `servedParts` is what the GET carried (or null): stored identity wins
 *  wherever it joins to the text — the same partsForDocument rule the lock
 *  flow already follows, so the deck and the lock PUT can never disagree
 *  about which part a paragraph is. */
export function buildDeckChunks(
  document: string,
  servedParts: readonly Part[] | null | undefined,
  suggestions: readonly DeckSuggestionLite[]
): DeckChunk[] {
  // The render split and the parts split are the same scanner over the same
  // string, both dropping blank paragraphs — index i in one IS index i in
  // the other (the lockTargetAt proof). Keeping the UNTRIMMED span offsets
  // means suggestion spans intersect without re-anchoring.
  const spans = splitBadgeParagraphSpans(document).filter(
    (p) => p.text.trim().length > 0
  );
  const parts = partsForDocument(document, servedParts);
  const n = Math.min(spans.length, parts.length);

  const chunks: DeckChunk[] = [];
  for (let i = 0; i < n; i += 1) {
    const { start, end } = spans[i];
    const pendingIds: string[] = [];
    const approvedIds: string[] = [];
    for (const s of suggestions) {
      if (!overlaps(s, start, end)) continue;
      // null = UNDECIDED (R4). "dismissed" contributes nothing — a kept-mine
      // proposal is history, and history never colours the page.
      if (s.status === "approved") approvedIds.push(s.id);
      else if (s.status !== "dismissed") pendingIds.push(s.id);
    }
    const locked = parts[i].locked === true;
    const status: ChunkStatus = locked
      ? "locked"
      : pendingIds.length > 0
        ? "waiting"
        : approvedIds.length > 0
          ? "accepted"
          : "clean";
    chunks.push({
      part: parts[i],
      paragraphIndex: i,
      start,
      end,
      status,
      pendingIds,
      approvedIds,
    });
  }
  return chunks;
}

/** One slide section of the deck: a kicker index + its chunks, in order. */
export interface DeckSlideGroup {
  /** 0-based slide the words were delivered on, or null when the document
   *  has no provable slide attachment (then the deck renders one section). */
  slideIndex: number | null;
  chunks: DeckChunk[];
}

/** Group chunks into slide sections using the pieces zip.
 *
 *  Same safe-ahead rule the pill lane follows (IdealPiece.slideIndex): the
 *  zip is trusted ONLY when the counts match exactly — paragraph i is piece
 *  i. A piece without slide_index falls back to "paragraph i = page i". On
 *  any mismatch the deck shows one untitled section rather than guessing an
 *  attachment. */
export function groupChunksBySlide(
  chunks: readonly DeckChunk[],
  pieceSlideIndexes: readonly (number | null)[] | null | undefined
): DeckSlideGroup[] {
  const zip =
    pieceSlideIndexes != null && pieceSlideIndexes.length === chunks.length;
  if (!zip) {
    return chunks.length > 0
      ? [{ slideIndex: null, chunks: [...chunks] }]
      : [];
  }
  const groups: DeckSlideGroup[] = [];
  chunks.forEach((c, i) => {
    const slide = pieceSlideIndexes[i] ?? i;
    const last = groups[groups.length - 1];
    if (last && last.slideIndex === slide) last.chunks.push(c);
    else groups.push({ slideIndex: slide, chunks: [c] });
  });
  return groups;
}
