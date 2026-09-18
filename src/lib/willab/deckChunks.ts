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
  /** Which bookmark this item is (contract 24g). Optional and safe-ahead: a
   *  backend that does not send it leaves every mark exactly as it was. */
  bookmarkTier?: "exercise" | "most_confident" | "standard" | null;
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
  /** The bookmark this paragraph wears (contract 24g), from the UNDECIDED
   *  items on it. A settled item is no longer asking for anything, so it stops
   *  colouring the mark — 24g-1's "the clean text IS the settled state". */
  tier?: "exercise" | "most_confident" | "standard" | null;
  /** DISPLAY ONLY — the piece of this paragraph shown on THIS screen.
   *
   *  Set when a paragraph is too tall for one screen and is split across
   *  several (founder 2026-09-17). Everything that ACTS on the paragraph —
   *  the lock echo, the sheet, the identity, the suggestion spans — keeps
   *  reading `part.text`, which stays the whole paragraph on every piece.
   *  That is what lets the bookmark and Lock repeat on each screen the
   *  paragraph touches and still mean one decision about one paragraph.
   *
   *  Absent on an unsplit paragraph, which is the overwhelming majority. */
  displayText?: string;
  /** Which piece this is, and how many there are. Both absent when unsplit. */
  sliceIndex?: number;
  sliceCount?: number;
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
/** The strongest bookmark among the undecided items on one paragraph.
 *
 *  The order is the contract's, not a preference: the exercise is the one item
 *  the speaker is asked to go and DO (24f), so it takes the mark; green marks
 *  work already done well; everything else is an ordinary bookmark. Position
 *  among the greens is never consulted, because there is none to consult —
 *  first and second are identical by construction (24i). */
function pickTier(
  tiers: readonly NonNullable<DeckSuggestionLite["bookmarkTier"]>[],
): DeckChunk["tier"] {
  if (tiers.includes("exercise")) return "exercise";
  if (tiers.includes("most_confident")) return "most_confident";
  return tiers.length > 0 ? "standard" : null;
}

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
    const tiers: NonNullable<DeckSuggestionLite["bookmarkTier"]>[] = [];
    for (const s of suggestions) {
      if (!overlaps(s, start, end)) continue;
      // null = UNDECIDED (R4). "dismissed" contributes nothing — a kept-mine
      // proposal is history, and history never colours the page.
      if (s.status === "approved") approvedIds.push(s.id);
      else if (s.status !== "dismissed") {
        pendingIds.push(s.id);
        // Only an UNDECIDED item colours the mark. An approved or dismissed
        // one has been dealt with, and a bookmark that keeps its colour after
        // the decision is a document that never empties (24g-1).
        if (s.bookmarkTier) tiers.push(s.bookmarkTier);
      }
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
    // ONE PARAGRAPH, ONE BOOKMARK (contract 24g). A paragraph can hold more
    // than one undecided item, and the marks are not equal: the exercise is
    // the single thing the speaker is asked to go and do, so it outranks a
    // green, which in turn outranks an ordinary mark. Ranked rather than
    // first-wins, because span order is not a priority.
    const tier = pickTier(tiers);
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
      tier,
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

/* ---------------------- audit Q-C5: one state per chunk ------------------- */

/** What has happened to these words — the modal's kicker fact, NOT a fourth
 *  page status. ChunkStatus stays three-valued (2026-08-15: green means
 *  LOCKED IN, and only the server's own flag says that); the approved-not-
 *  locked distinction lives here, read from the approved rider. */
export type ChunkDecision = "locked" | "approved" | "none";

export type CoachReviewStatus = NonNullable<CoachMomentLite["reviewStatus"]>;

/** The coach's own feedback on this chunk's words (slice 4), joined once. */
export interface ChunkCoach<M extends CoachMomentLite = CoachMomentLite> {
  moment: M | null;
  /** The snippet the coach left a note or a video on — only when the BE's
   *  existence flag says there is one to fetch. */
  snippetId: string | null;
  /** Visible async workflow state; present even before an explanation. */
  reviewStatus: CoachReviewStatus | null;
  /** A coach explanation exists on these words. */
  hasFeedback: boolean;
}

export interface ChunkHistoryLite {
  quote: string | null;
  proposedText: string | null;
}

/** ONE STATE PER CHUNK (audit Q-C5, founder decision 2026-09-14, option a).
 *
 *  Everything the deck page and the chunk modal branch on, computed once per
 *  chunk from the served document: identity and spans (`chunk`), the page
 *  status, the lock, the decision kicker, the pending inventory (≤ 3 — the
 *  backend caps the complete Take inventory), the style-lane proposal, the
 *  decided-proposal history that belongs to these words, and the coach's
 *  join. The surfaces read it; they never re-derive it. Pure — no React. */
export interface ChunkState<
  S extends DeckSuggestionLite = DeckSuggestionLite,
  H extends ChunkHistoryLite = ChunkHistoryLite,
  M extends CoachMomentLite = CoachMomentLite,
> {
  chunk: DeckChunk;
  status: ChunkStatus;
  /** The server-owned lock (the same flag the page's green mark reads). */
  locked: boolean;
  decision: ChunkDecision;
  /** Undecided proposals on these words, in inventory order. */
  pending: S[];
  /** The pending post-lock style proposal, or null. */
  style: S | null;
  /** Decided proposals whose words belong to this chunk. */
  history: H[];
  coach: ChunkCoach<M>;
}

export interface ChunkStateInputs<
  S extends DeckSuggestionLite,
  H extends ChunkHistoryLite,
  M extends CoachMomentLite,
> {
  document: string;
  suggestions: readonly S[];
  styleChanges?: readonly S[] | null;
  decisionHistory?: readonly H[] | null;
  coachMoments?: readonly M[] | null;
}

/** The backend caps a Take's complete feedback inventory at three. */
export const PENDING_INVENTORY_CAP = 3;

function stateFor<
  S extends DeckSuggestionLite,
  H extends ChunkHistoryLite,
  M extends CoachMomentLite,
>(
  chunk: DeckChunk,
  inputs: ChunkStateInputs<S, H, M>,
  byId: ReadonlyMap<string, S>
): ChunkState<S, H, M> {
  const pending = chunk.pendingIds
    .map((id) => byId.get(id) ?? null)
    .filter((s): s is S => s !== null)
    .slice(0, PENDING_INVENTORY_CAP);
  const moment = coachMomentForChunk(inputs.coachMoments, inputs.document, chunk);
  const hasFeedback = moment?.hasExplanation === true;
  const locked = chunk.part.locked === true;
  return {
    chunk,
    status: chunk.status,
    locked,
    // KEYED ON THE APPROVED RIDER, not on `chunk.status` (see ChunkDecision).
    decision: locked ? "locked" : chunk.approvedIds.length > 0 ? "approved" : "none",
    pending,
    style: styleFor(inputs.styleChanges, chunk),
    history: historyForChunk(inputs.decisionHistory, chunk.part.text),
    coach: {
      moment,
      snippetId: hasFeedback ? (moment?.snippetId ?? null) : null,
      reviewStatus: moment?.reviewStatus ?? null,
      hasFeedback,
    },
  };
}

function suggestionsById<S extends DeckSuggestionLite>(
  suggestions: readonly S[]
): Map<string, S> {
  const byId = new Map<string, S>();
  for (const s of suggestions) if (!byId.has(s.id)) byId.set(s.id, s);
  return byId;
}

/** The state of one chunk. */
export function chunkStateFor<
  S extends DeckSuggestionLite,
  H extends ChunkHistoryLite,
  M extends CoachMomentLite,
>(chunk: DeckChunk, inputs: ChunkStateInputs<S, H, M>): ChunkState<S, H, M> {
  return stateFor(chunk, inputs, suggestionsById(inputs.suggestions));
}

/** The state of every chunk of one served document, in chunk order. */
export function buildChunkStates<
  S extends DeckSuggestionLite,
  H extends ChunkHistoryLite,
  M extends CoachMomentLite,
>(
  chunks: readonly DeckChunk[],
  inputs: ChunkStateInputs<S, H, M>
): ChunkState<S, H, M>[] {
  const byId = suggestionsById(inputs.suggestions);
  return chunks.map((chunk) => stateFor(chunk, inputs, byId));
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
  | "piece_identity_mismatch"
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
  slideCount: number | null,
  piecePartIds?: readonly (string | null)[] | null
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
  if (piecePartIds && piecePartIds.length !== chunks.length) {
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
    const expectedPartId = piecePartIds?.[i] ?? null;
    if (expectedPartId !== null && expectedPartId !== chunks[i].part.id) {
      return groupingError("piece_identity_mismatch", i);
    }
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

/** WHICH PARAGRAPH THE OPEN SHEET IS LOOKING AT. */
export interface OpenChunkRef {
  /** The part id the sheet was opened on. */
  id: string;
  /** Its position in the render/parts split at that moment. */
  index: number;
  /** Its words, trimmed — the proof carried at runtime. */
  text: string;
}

/** Find the chunk an open sheet belongs to, surviving an identity re-mint.
 *
 *  REPORTED FROM REAL USE 2026-09-16: "the overlay disappears when it's open".
 *
 *  The sheet used to be found by part id alone. That id is not stable: the
 *  deck's parts come from `partsForDocument`, which honours the SERVED ids
 *  only while they join back to the served text and otherwise re-derives
 *  through `reconcileParts` — and `reconcileParts` mints a fresh uuid for any
 *  paragraph whose exact words it cannot match. A background refetch can
 *  therefore hand the same paragraph back under a NEW id, the id lookup
 *  returns nothing, and the open sheet unmounts under the speaker's hands.
 *  A lock is followed by a refetch, so the window is wide open at exactly the
 *  moment they have decided something.
 *
 *  POSITION + WORDS IS THE FALLBACK, and it is not a new idea here: it is the
 *  claim `deckLockPart` and `lockTargetAt` already use, for the same reason —
 *  "both splits are the same scanner over the same string", so the index is
 *  provable, and the words are the proof carried at runtime.
 *
 *  It never guesses. Words that changed do not match, so a paragraph whose
 *  text was rewritten under the sheet is NOT silently re-adopted; and a
 *  paragraph that is genuinely gone resolves to null and the sheet closes,
 *  which is the honest outcome. Pure. */
export function resolveOpenChunk(
  chunks: readonly DeckChunk[],
  open: OpenChunkRef | null,
): DeckChunk | null {
  if (!open) return null;
  const byId = chunks.find((c) => c.part.id === open.id);
  if (byId) return byId;
  return (
    chunks.find(
      (c) =>
        c.paragraphIndex === open.index && c.part.text.trim() === open.text,
    ) ?? null
  );
}

/** Does this paragraph have a Confident Voice judgement waiting on it?
 *
 *  Founder 2026-09-17: "the bookmark should only be next to the confident
 *  voice — not at every end of the paragraph... not every paragraph has the
 *  confident voice, so show it only when there is a confident voice judgement
 *  waiting under that bookmark."
 *
 *  A VISIBILITY RULE, NOT A STRUCTURAL ONE — the founder was explicit: "it's
 *  about visibility to the user and keeping the user flow tight, not about
 *  changing the structure of the app". So nothing about the sheet, the ladder,
 *  the lock or the inventory moves. One predicate decides whether the mark is
 *  painted; everything behind it is untouched and every item the Manager
 *  approved is still in the sheet when it opens.
 *
 *  Two ways a judgement can be waiting, and both count because both are the
 *  same question to the speaker: an undecided Confident Voice item in the
 *  chunk's own inventory, and a Confident Moment marker from the overlay that
 *  carries it.
 *
 *  Pure. */
export function markWorthShowing(
  pending: readonly { feedbackFamily?: string | null; source?: string | null }[],
  moments?: readonly unknown[] | null,
): boolean {
  const waiting = pending.some(
    (item) =>
      item.feedbackFamily === "confident_voice" ||
      item.source === "confident_voice",
  );
  return waiting || (moments ?? []).length > 0;
}
