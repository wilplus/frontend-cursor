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
/*  THREE STATUSES, derived, never stored (founder 2026-08-11 — NOTHING       */
/*  paints the text any more. No underline, no wash. The state lives only in   */
/*  the chunk's icon and the words stay clean, which is the whole point of a   */
/*  page you are supposed to be able to read):                                 */
/*    locked   — SERVER-LOCKED. The student locked these words in.             */
/*    waiting  — at least one UNDECIDED suggestion overlaps the chunk.         */
/*    clean    — nothing pending, and not locked in.                           */
/*                                                                            */
/*  ⚠️ 2026-08-15 — "ACCEPTED" IS NOT "LOCKED". Until today `locked` also      */
/*  covered "an approved suggestion rides it", per the 2026-08-11 merge of     */
/*  the two final states. By this week that merge had one observable effect    */
/*  left and it was a defect: on accept the suggestion flips to approved for   */
/*  the few milliseconds before the server bakes the change and drops it, so   */
/*  the mark flashed GREEN and then settled GREY. The student was shown the    */
/*  final state on the way to the in-between one. Green now means locked in,   */
/*  full stop, and accepting lands on `clean` — which is what is true.         */
/*  The accepted-not-locked fact still exists; it is read off `approvedIds`    */
/*  by the modal, where it informs instead of misleading.                      */
/*                                                                            */
/*  Precedence is unchanged where it was load-bearing: the server lock wins    */
/*  over everything, and a pending suggestion still beats an approved one on   */
/*  the same chunk — there is feedback outstanding, and merging the two final  */
/*  states must not swallow that.                                              */
/*                                                                            */
/*  R4 alignment: a suggestion with status null is UNDECIDED — absence of a    */
/*  decision is pending, exactly the ground-truth rule the BE's decisions      */
/*  ledger follows. Coercing null to "not pending" would hide feedback.        */
/*                                                                            */
/*  Pure — no React, no fetch.                                                 */
/* -------------------------------------------------------------------------- */

export type ChunkStatus = "clean" | "waiting" | "locked";

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
function overlaps(
  s: { start: number; end: number },
  start: number,
  end: number
): boolean {
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
    // PENDING WORK BEATS THE LOCK (founder 2026-08-11: "once locked in but
    // smth new appears there keep iterating and showing the suggestions").
    //
    // The lock used to win unconditionally, and that one line was the whole
    // of "the feedback engine pipe is dead while it is locked in". The
    // backend served the new take's proposals; `pendingIds` was computed
    // here and then used for nothing the student could see — the text is
    // deliberately never painted, DeckLockMark keys on `status`, and the
    // modal opens its REVIEW face only for "waiting". So every proposal on
    // a locked chunk was announced nowhere and openable never.
    // ⚠️ ACCEPTED IS NOT LOCKED (founder 2026-08-15). This read
    // `locked || approvedIds.length > 0`, merging the two final states per the
    // 2026-08-11 ruling. That merge had exactly one observable effect left,
    // and it was a defect: accepting a change flipped the suggestion to
    // "approved", the mark turned GREEN for the few milliseconds before the
    // server baked the change and dropped the suggestion, and then it settled
    // to grey. The student saw the final state flash by on the way to the
    // in-between one — "it remains green in between, it is confusing".
    //
    // Green is now what it says: LOCKED IN, and only the server's own flag
    // says that. Accepting lands on "clean", which is the truth — nothing is
    // pending on these words and the student has not locked them yet.
    //
    // The distinction the merge existed to express is not lost, it moved to
    // where it belongs: DeckChunkModal reads `approvedIds` (still computed
    // below) for its "Accepted · not locked in yet" kicker. Inside the modal
    // that fact is useful; on the page it was a colour that lied.
    const status: ChunkStatus = pendingIds.length > 0
      ? "waiting"
      : locked
        ? "locked"
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

/* ------------------------- slice 2: modal-side joins ----------------------- */

/** Case/punctuation-insensitive form for joining ledger rows to chunk text.
 *  Old spans die on every reassembly, so HISTORY joins by words — the same
 *  reasoning as the prior-take lane's normalize_phrase. */
export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** History entries that belong to this chunk: their quote (or, failing
 *  that, their proposed text) appears in the chunk's words. A row that
 *  matches nothing on screen matches no chunk — never guessed in. */
export function historyForChunk<
  T extends { quote: string | null; proposedText: string | null },
>(history: readonly T[] | null | undefined, chunkText: string): T[] {
  if (!history || history.length === 0) return [];
  const hay = ` ${normalizeForMatch(chunkText)} `;
  return history.filter((h) => {
    const needle = h.quote ?? h.proposedText;
    if (!needle) return false;
    const n = normalizeForMatch(needle);
    return n.length > 0 && hay.includes(` ${n} `);
  });
}

/** The first pending style-lane proposal overlapping this chunk (its spans
 *  index the same served document). Surfaced only inside the modal — the
 *  page never marks it (locked text is never re-underlined). */
export function styleFor<
  T extends {
    start: number;
    end: number;
    status: "pending" | "approved" | "dismissed" | null;
  },
>(styleChanges: readonly T[] | null | undefined, chunk: DeckChunk): T | null {
  for (const s of styleChanges ?? []) {
    if (s.status === "approved" || s.status === "dismissed") continue;
    if (overlaps(s, chunk.start, chunk.end)) return s;
  }
  return null;
}

/* ---------------------- slice 4: the coach's own feedback ------------------ */

/** The slice of a key moment this join needs — the coach left something on
 *  these words, and `anchor` is where they are. */
export interface CoachMomentLite {
  snippetId: string;
  /** The literal text fragment in the SERVED document (the BE guarantees it
   *  was the moment marker's inner text before the markers were stripped). */
  anchor: string;
  /** The BE's free existence flag: surfaced, with a note and/or a video. */
  hasExplanation?: boolean;
  /** Visible async workflow state. Presence makes the moment actionable even
   *  before a coach-authored explanation exists. */
  reviewStatus?:
    | "pending_coach_review"
    | "coach_reviewed"
    | "not_confirmed"
    | null;
}

/** The coach moment that belongs to this chunk, or null.
 *
 *  Joined by the ANCHOR's position in the served document — the same
 *  offsets-into-the-same-string rule the suggestion spans use, so no
 *  re-anchoring and no second notion of "where". An anchor that is not in
 *  the document (its paragraph was locked and retyped, a take recomposed
 *  the words) simply matches nothing and the chunk shows no coach card:
 *  the deck's standing rule is drop, never guess.
 *
 *  Only moments that carry a coach explanation or a visible async-review
 *  state are considered. A bare acoustic anchor is not feedback. */
export function coachMomentForChunk<T extends CoachMomentLite>(
  moments: readonly T[] | null | undefined,
  document: string,
  chunk: DeckChunk
): T | null {
  for (const m of moments ?? []) {
    if (m.hasExplanation !== true && !m.reviewStatus) continue;
    const anchor = (m.anchor || "").trim();
    if (!anchor) continue;
    const at = document.indexOf(anchor);
    if (at < 0) continue;
    if (overlaps({ start: at, end: at + anchor.length }, chunk.start, chunk.end)) {
      return m;
    }
  }
  return null;
}

/** One slide section of the deck: a kicker index + its chunks, in order. */
export interface DeckSlideGroup {
  /** 0-based slide the words were delivered on, or null when the document
   *  has no provable slide attachment (then the deck renders one section). */
  slideIndex: number | null;
  chunks: DeckChunk[];
}

export type DeckSlideGroupingError =
  | "piece_count_mismatch"
  | "missing_slide_mapping"
  | "missing_parent_slide"
  | "invalid_slide_index"
  | "slide_out_of_range"
  | "slide_order_regression";

export type DeckSlideGroupingResult =
  | { ok: true; groups: DeckSlideGroup[] }
  | {
      ok: false;
      error: DeckSlideGroupingError;
      /** Paragraph whose mapping made the invariant unprovable, when known. */
      paragraphIndex: number | null;
    };

function groupingError(
  error: DeckSlideGroupingError,
  paragraphIndex: number | null = null
): DeckSlideGroupingResult {
  return { ok: false, error, paragraphIndex };
}

/** Group chunks into real slide sections using the exact pieces zip.
 *
 *  The deck count is authority. Paragraph ORDINAL is never a slide identity:
 *  a null slide index inherits the nearest preceding real slide and therefore
 *  remains in that slide's group (where buildScreens may make a continuation
 *  screen if the words do not fit). A leading null, an invalid/out-of-range
 *  explicit index, a backwards mapping, or a broken zip is an explicit
 *  recoverable error — never a fabricated slide.
 *
 *  A null slideCount is the safe-ahead older-payload case. Explicit mappings
 *  can still be used, but no upper bound is invented. With no mapping and no
 *  known deck, the document remains one untitled talk section. */
export function groupChunksBySlide(
  chunks: readonly DeckChunk[],
  pieceSlideIndexes: readonly (number | null)[] | null | undefined,
  slideCount: number | null
): DeckSlideGroupingResult {
  if (chunks.length === 0) return { ok: true, groups: [] };

  const canonicalSlideCount =
    typeof slideCount === "number" &&
    Number.isInteger(slideCount) &&
    slideCount >= 0
      ? slideCount
      : null;

  if (pieceSlideIndexes == null) {
    if (canonicalSlideCount !== null && canonicalSlideCount > 0) {
      return groupingError("missing_slide_mapping");
    }
    return {
      ok: true,
      groups: [{ slideIndex: null, chunks: [...chunks] }],
    };
  }

  if (pieceSlideIndexes.length !== chunks.length) {
    return groupingError("piece_count_mismatch");
  }

  if (canonicalSlideCount === 0) {
    const explicitAt = pieceSlideIndexes.findIndex((slide) => slide !== null);
    if (explicitAt >= 0) {
      return groupingError("slide_out_of_range", explicitAt);
    }
    return {
      ok: true,
      groups: [{ slideIndex: null, chunks: [...chunks] }],
    };
  }

  const groups: DeckSlideGroup[] = [];
  let previousSlide: number | null = null;
  for (let i = 0; i < chunks.length; i += 1) {
    const mappedSlide = pieceSlideIndexes[i];
    let slide: number;
    if (mappedSlide === null) {
      if (previousSlide === null) {
        return groupingError("missing_parent_slide", i);
      }
      slide = previousSlide;
    } else {
      if (
        !Number.isInteger(mappedSlide) ||
        mappedSlide < 0 ||
        !Number.isFinite(mappedSlide)
      ) {
        return groupingError("invalid_slide_index", i);
      }
      if (
        canonicalSlideCount !== null &&
        mappedSlide >= canonicalSlideCount
      ) {
        return groupingError("slide_out_of_range", i);
      }
      if (previousSlide !== null && mappedSlide < previousSlide) {
        return groupingError("slide_order_regression", i);
      }
      slide = mappedSlide;
    }

    const last = groups[groups.length - 1];
    if (last && last.slideIndex === slide) last.chunks.push(chunks[i]);
    else groups.push({ slideIndex: slide, chunks: [chunks[i]] });
    previousSlide = slide;
  }
  return { ok: true, groups };
}
