"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import DeckChunkModal, {
  type LockOutcome,
  type LockResult,
} from "@/components/willab/DeckChunkModal";
import type { RootPhraseSpan } from "@/services/api/partLock";
import DeckLockMark from "@/components/willab/DeckLockMark";
import MarkedEditor from "@/components/willab/MarkedEditor";
import { RichText } from "@/components/willab/RichText";
import DeckSlidePreview from "@/components/willab/DeckSlidePreview";
import { parseRichSpans } from "@/lib/willab/richMarkers";
import {
  buildChunkStates,
  buildDeckChunks,
  chunkStateFor,
  groupChunksBySlide,
  markWorthShowing,
  resolveOpenChunk,
  type ChunkState,
  type CoachMomentLite,
  type DeckChunk,
  type DeckSlideGroupingResult,
  type OpenChunkRef,
} from "@/lib/willab/deckChunks";
import {
  buildScreens,
  SCREEN_MAX_CHUNKS,
  type ScreenFit,
  canBubble,
  chunkCounts,
  clampPosition,
  firstUnreadScreenIndex,
  IDLE_WHEEL_GESTURE,
  nearestChunkIndex,
  screenPositionOfPart,
  scrollEdge,
  stepPosition,
  wheelGestureStep,
  type DeckPosition,
  type DeckScreenModel,
  type WheelGestureState,
} from "@/lib/willab/deckScroll";
import {
  fitChangedMeaningfully,
  measureScreenFit,
  tightestFit,
} from "@/lib/willab/measureScreenFit";
import { partRootTint, type Part } from "@/lib/willab/documentParts";
import { bundleRootTint } from "@/lib/willab/rootPhraseLayer";
import type {
  DecisionHistoryEntry,
  DocumentSuggestion,
} from "@/services/api/idealText";
import type {
  ConfidentMomentOwnerEdit,
  ConfidentMomentSummary,
} from "@/services/api/confidentMomentBundles";
import ConfidentMomentCoachingBundle from "./ConfidentMomentCoachingBundle";
import { useConfidentMomentBundle } from "./useConfidentMomentBundle";

/* -------------------------------------------------------------------------- */
/*  TranscriptReviewDeck — the ideal text as a slide deck (founder 2026-08-11, */
/*  Lovable spec §4). One slide per viewport, scroll-snap, a dots rail, and    */
/*  every chunk wearing exactly one always-clickable lock.                     */
/*                                                                            */
/*  The deck is presentation + routing only. The HOST owns the fetch and the   */
/*  three decide lanes + the lock PUT — passed in as callbacks — so this       */
/*  surface cannot fork the serve/decide/lock contract it renders.             */
/*                                                                            */
/*  VISUAL GRAMMAR: feedback state never paints the text. The one intentional  */
/*  exception is the user's separately approved, exact rooting phrase: its     */
/*  persisted span is orange in the Ideal Text itself.                         */
/*                                                                            */
/*  The underline had to go because of what it did at scale rather than what   */
/*  it meant: it marks the chunk a suggestion sits in, and when a whole talk   */
/*  arrived as ONE chunk it striped all 233 words amber over a single pending  */
/*  note. Even now that chunks are per-slide, a paragraph-wide underline is    */
/*  the wrong grain for a phrase-sized remark, and it makes the one thing the  */
/*  screen exists for — reading your own speech — harder.                      */
/*                                                                            */
/*  Chrome is stripped to match: no frame, no height cap, no footer. The text  */
/*  gets the room.                                                             */
/* -------------------------------------------------------------------------- */

/** Say WHY the deck flattened (founder 2026-09-18: "after a lock the text
 *  skipped the slides and got concatenated again").
 *
 *  `groupChunksBySlide` distinguishes seven typed failures and all seven drew
 *  the same screen — one unlinked section holding the whole document, no slide
 *  kickers, and no slide picture, because the preview is rendered per slide
 *  group. The reason was computed and dropped, so a snapshot that lost its
 *  slide indexes and a lock that re-minted a part id were indistinguishable
 *  from the outside.
 *
 *  Developer signal only. The degrade stays quiet for the SPEAKER — a
 *  provenance defect must not replace their words — and new user-facing copy
 *  needs founder sign-off. Module scope because the deck is at the complexity
 *  ratchet's grandfathered ceiling and may only come down. */
function warnUnlinked(
  grouping: DeckSlideGroupingResult,
  chunks: readonly DeckChunk[],
  slideCount: number | null,
  pieceSlideIndexes: readonly (number | null)[] | null | undefined,
  piecePartIds: readonly (string | null)[] | null | undefined,
): void {
  if (grouping.ok || chunks.length === 0) return;
  const at = grouping.paragraphIndex;
  console.warn("[deck] slide grouping failed — rendering one unlinked section", {
    reason: grouping.error,
    paragraphIndex: at,
    // BOTH SIDES OF THE COMPARISON THAT FAILED (2026-09-19). The first cut
    // logged only the id the deck HAS, which proves nothing on its own: the
    // question is always whether it equals the id the pieces zip EXPECTS, and
    // without the expected value beside it a `piece_identity_mismatch` needs
    // another round trip to interpret. `expectedAt` is where the deck's id
    // does appear in the zip, if it appears at all — `-1` means the id is
    // absent entirely (re-minted identity), any other number means the two
    // lists hold the same ids in a different ORDER, and those are different
    // bugs in different repos.
    partId: at === null ? null : (chunks[at]?.part.id ?? null),
    expectedPartId: at === null ? null : (piecePartIds?.[at] ?? null),
    expectedAt:
      at === null || !piecePartIds
        ? null
        : piecePartIds.indexOf(chunks[at]?.part.id ?? ""),
    chunks: chunks.length,
    slideCount,
    slideIndexes: pieceSlideIndexes?.length ?? null,
    partIds: piecePartIds?.length ?? null,
  });
}

/** The same answer as attributes, readable from a device with no inspector —
 *  the phone this was first seen on. Built here, not inline, for the ratchet.
 *
 *  IT CARRIES THE IDS TOO (2026-09-19). The pair that decides a
 *  `piece_identity_mismatch` lived only in a `console.warn`, and a console with
 *  its Warnings filter off — the default in more than one browser's saved
 *  state — hides it completely. The founder read this element three times and
 *  saw three attributes, because the two that mattered were in a message he
 *  was never shown. A diagnostic that a filter can suppress is a diagnostic
 *  that is absent exactly when someone is hunting for it, so the answer now
 *  also sits in the DOM, where nothing can filter it. */
function linkageAttrs(
  grouping: DeckSlideGroupingResult,
  chunks: readonly DeckChunk[],
  piecePartIds: readonly (string | null)[] | null | undefined,
) {
  if (grouping.ok) return { "data-slide-linkage": "linked" as const };
  const at = grouping.paragraphIndex;
  const held = at === null ? null : (chunks[at]?.part.id ?? null);
  return {
    "data-slide-linkage": "unlinked" as const,
    "data-slide-linkage-reason": grouping.error,
    ...(at === null ? {} : { "data-slide-linkage-at": String(at) }),
    ...(held === null
      ? {}
      : {
          "data-slide-linkage-held": held,
          "data-slide-linkage-expected": piecePartIds?.[at as number] ?? "",
          // Where the deck's own id sits in the zip: -1 = absent entirely
          // (identity was minted client-side), anything else = the same ids
          // in a different order. Two different bugs, two different repos.
          "data-slide-linkage-found-at": String(
            piecePartIds ? piecePartIds.indexOf(held) : -1,
          ),
        }),
  };
}

export default function TranscriptReviewDeck({
  title = "",
  statusChip = null,
  chrome = "full",
  document: doc,
  parts,
  suggestions,
  pieceSlideIndexes,
  piecePartIds = null,
  slideTitles,
  presentationRef = null,
  onAccept,
  onUndoAccept,
  onKeepMine,
  onJudged,
  onLockPart,
  onKeepEvolving,
  onSetRootPhrase,
  onEditSlide,
  onUnlockPart = null,
  onClose,
  styleChanges = null,
  onApplyStyle,
  decisionHistory = null,
  coachMoments = null,
  arcId = null,
  takeSessionId = null,
  confidentMomentSummary = null,
  confidentMomentOwnerEdit = null,
  onConfidentMomentChanged,
  feedbackPending = false,
  takeCount = null,
}: {
  title?: string;
  /** Optional right-of-title chip (e.g. "Verified"). Qualitative only. */
  statusChip?: string | null;
  /** "full" renders the deck's own header (title · copy · close — Lovable
   *  §4). "stage" renders stage + dots + footer only, for a host that keeps
   *  its own header (the notebook overlay does — its Present/edit/timeline
   *  entries are load-bearing and live outside the deck's scope). */
  chrome?: "full" | "stage";
  document: string;
  parts: readonly Part[] | null;
  suggestions: readonly DocumentSuggestion[];
  pieceSlideIndexes: readonly (number | null)[] | null;
  /** Exact Paragraph ids paired with `pieceSlideIndexes`. Legacy payloads may
   *  omit them; new payloads fail closed rather than attach a Slide to a
   *  different Paragraph after an edit. */
  piecePartIds?: readonly (string | null)[] | null;
  /** Slide titles by slide index, when the host knows them. Absent → the
   *  kicker says "Slide N" and no title line renders — never a guess. */
  slideTitles?: readonly (string | null)[];
  /** The actual attached/default PDF. When present, Ideal Text and its
   *  slide-scoped editor show the real slide rather than a text substitute. */
  presentationRef?: string | null;
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  onUndoAccept?: (s: DocumentSuggestion) => Promise<boolean>;
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  /** The Confident Voice judgement, the moment it is saved (see the sheet). */
  onJudged?: (s: DocumentSuggestion, decided: "approved" | "dismissed") => void;
  /** Commit `newText` for the chunk (when changed) and lock it.
   *
   *  The whole CHUNK goes back, not just its part: the host addresses a lock
   *  by POSITION + WORDS, never by the part id. Identity is derived in two
   *  places — here from the served parts, and in the host from whatever it
   *  last held — and when the backend has no stored parts (any document
   *  never manually edited) both sides mint their own uuids and no id can
   *  ever match. That mismatch is what made every lock fail with
   *  "Couldn't lock this in" on a fresh arc. Position + words is the claim
   *  the lock endpoint verifies anyway. */
  onLockPart: (chunk: DeckChunk, newText: string) => Promise<LockResult>;
  onKeepEvolving: (chunk: DeckChunk, newText: string) => Promise<LockOutcome>;
  onSetRootPhrase: (
    chunk: DeckChunk,
    phrase: RootPhraseSpan | null,
  ) => Promise<boolean>;
  /** Save only the current slide's changed paragraphs in one atomic document
   *  edit; all other slides remain byte-for-byte unchanged. */
  onEditSlide: (
    edits: Array<{ chunk: DeckChunk; text: string }>
  ) => Promise<boolean>;
  /** UNDO a lock (founder 2026-08-15). "Discard" on a locked chunk is the
   *  inverse of "Lock in", not a close — see DeckChunkModal. Optional so a
   *  host without the capability shows no button rather than a dead one. */
  onUnlockPart?: ((chunk: DeckChunk) => Promise<LockOutcome>) | null;
  onClose?: () => void;
  /** Legacy post-lock bold proposals, retained for already-created records. */
  styleChanges?: readonly DocumentSuggestion[] | null;
  onApplyStyle?: (s: DocumentSuggestion) => Promise<boolean>;
  /** PROPOSAL HISTORY (slice 2) — decided proposals, texts included. */
  decisionHistory?: readonly DecisionHistoryEntry[] | null;
  /** THE COACH (slice 4) — the arc's key moments, joined to a chunk by their
   *  anchor so the modal can offer the coach's own note/video on those
   *  words. The message itself loads on demand (that read is metered). */
  coachMoments?: readonly CoachMomentLite[] | null;
  arcId?: string | null;
  takeSessionId?: string | null;
  /** The project's official-take count; 1 marks the first take. */
  takeCount?: number | null;
  confidentMomentSummary?: ConfidentMomentSummary | null;
  confidentMomentOwnerEdit?: ConfidentMomentOwnerEdit | null;
  /** The feedback request has not answered yet, so no paragraph can be said
   *  to have nothing waiting. Reserves each mark's footprint rather than
   *  letting the marks arrive late and move the words. */
  feedbackPending?: boolean;
  onConfidentMomentChanged?: () => void;
}) {
  const confidentMoments = useConfidentMomentBundle({
    projectId: arcId,
    takeId: takeSessionId,
    summary: confidentMomentSummary,
  });
  const [openBundleId, setOpenBundleId] = useState<string | null>(null);
  const summaryByParagraph = useMemo(() => {
    const grouped = new Map<string, ConfidentMomentSummary["items"]>();
    for (const item of confidentMomentSummary?.items ?? []) {
      grouped.set(item.paragraphId, [...(grouped.get(item.paragraphId) ?? []), item]);
    }
    return grouped;
  }, [confidentMomentSummary]);
  const [paragraphBundleCursor, setParagraphBundleCursor] = useState<Record<string, number>>({});
  const openBundle = openBundleId
    ? confidentMoments.projection?.bundles.find((item) => item.bundleId === openBundleId) ?? null
    : null;
  /* §11.7.1 — INSTANT LOCK FEEDBACK (founder 2026-08-14). The modal
   * already closes on a successful lock; what lagged was the PAGE — the
   * lock icon waited for the host's refetch. A confirmed lock is marked
   * optimistically by part id and cleared the moment fresh parts arrive
   * (the server's truth always takes over). Only a "clean" chunk is
   * promoted — pending work still beats the lock (2026-08-11 rule). */
  const [optimisticLocked, setOptimisticLocked] = useState<
    ReadonlySet<string>
  >(new Set());
  /* The same instant feedback for the INVERSE (2026-08-15). Without it a
   * confirmed unlock leaves the mark green until the host refetches, which is
   * the same lag §11.7.1 was written to remove — just in the other
   * direction. Cleared on fresh parts; the server's truth always takes over. */
  const [optimisticUnlocked, setOptimisticUnlocked] = useState<
    ReadonlySet<string>
  >(new Set());
  useEffect(() => {
    setOptimisticLocked(new Set());
    setOptimisticUnlocked(new Set());
  }, [parts]);

  const chunks = useMemo(() => {
    const built = buildDeckChunks(doc, parts, suggestions);
    if (optimisticLocked.size === 0 && optimisticUnlocked.size === 0) {
      return built;
    }
    return built.map((c) => {
      if ((c.status === "clean" || c.status === "untouched")
          && optimisticLocked.has(c.part.id)) {
        return { ...c, status: "locked" as const };
      }
      // An unlock never overrides PENDING work — the 2026-08-11 rule that a
      // pending proposal beats the lock cuts both ways, and a chunk with
      // feedback outstanding must keep saying so.
      if (c.status === "locked" && optimisticUnlocked.has(c.part.id)) {
        return {
          ...c,
          status: "clean" as const,
          part: { ...c.part, locked: false },
        };
      }
      return c;
    });
  }, [doc, parts, suggestions, optimisticLocked, optimisticUnlocked]);
  // ONE STATE PER CHUNK (audit Q-C5): the joins the page and the modal both
  // read — the pending inventory, the style-lane proposal, the decided
  // history, the coach's own feedback — computed once per chunk here, never
  // per render per chunk. The modal receives one of these, not seven props.
  const stateInputs = useMemo(
    () => ({ document: doc, suggestions, styleChanges, decisionHistory, coachMoments }),
    [doc, suggestions, styleChanges, decisionHistory, coachMoments],
  );
  const stateByPartId = useMemo(() => {
    const states = buildChunkStates<
      DocumentSuggestion,
      DecisionHistoryEntry,
      CoachMomentLite
    >(chunks, stateInputs);
    return new Map(states.map((st) => [st.chunk.part.id, st]));
  }, [chunks, stateInputs]);
  const stateOf = useCallback(
    (c: DeckChunk): ChunkState<DocumentSuggestion, DecisionHistoryEntry, CoachMomentLite> =>
      stateByPartId.get(c.part.id) ?? chunkStateFor(c, stateInputs),
    [stateByPartId, stateInputs],
  );
  const slideCount = slideTitles?.length ?? null;
  const grouping = useMemo(
    () =>
      groupChunksBySlide(chunks, pieceSlideIndexes, slideCount, piecePartIds),
    [chunks, pieceSlideIndexes, slideCount, piecePartIds]
  );
  // TEXT AVAILABILITY IS NOT SLIDE-LINKAGE AVAILABILITY (2026-08-26).
  // A Take can finish with a durable Ideal Text while optional paragraph →
  // deck provenance is stale or temporarily unavailable. The former screen
  // treated that metadata defect as a broken document and replaced all of the
  // user's text with "Couldn't load your ideal text." Keep the strict mapper
  // (it still refuses to guess a slide), but degrade to one unlinked "Your
  // talk" section. The words remain openable; no slide identity is invented.
  const groups = useMemo(
    () =>
      grouping.ok
        ? grouping.groups
        : chunks.length > 0
          ? [{ slideIndex: null, chunks: [...chunks] }]
          : [],
    [grouping, chunks],
  );
  /* THE DEGRADE MUST NAME ITSELF (founder 2026-09-18: "after a lock the text
   * skipped the slides and got concatenated again").
   *
   * The fallback above is right and stays. What was wrong is that it was
   * SILENT: `groupChunksBySlide` distinguishes seven typed reasons, and all
   * seven collapsed into one unlinked section with the reason discarded. The
   * symptom the founder can see — every slide boundary gone, the whole talk
   * concatenated — is identical for a stale slide map, a lock that minted a
   * new part id, and a backwards mapping, so nobody could say which had
   * happened without adding a log and shipping it.
   *
   * Developer signal only: a console warning and a data attribute. Nothing
   * user-facing, because the degrade is deliberately quiet for the user (a
   * metadata defect must not replace their words) and new user-facing copy
   * needs founder sign-off. */
  useEffect(() => {
    warnUnlinked(grouping, chunks, slideCount, pieceSlideIndexes, piecePartIds);
  }, [grouping, chunks, slideCount, pieceSlideIndexes, piecePartIds]);
  const deckReady = groups.length > 0;
  /* §11.7.2/§11.7.3 — THE SCREEN GRAIN: the deck's sections are SCREENS
   * (≤3 chunks ≈ 9 lines), and a slide with more chunks CONTINUES on the
   * next screen. The nested scroll steps between screens; the rail shows
   * slide → screen (the chunk grain was cut 2026-08-15 — see the rail). */
  /* THE SPLIT FOLLOWS WHAT FITS (founder 2026-09-17): "if it exceeds then
     you make more screens with the text below, so it all fits". `fit` is
     null until the deck has rendered once and measured itself, and on that
     first pass the old fixed count of three is used — so the deck is never
     blank waiting for a measurement. */
  const [fit, setFit] = useState<ScreenFit | null>(null);
  const screens = useMemo(
    () =>
      buildScreens(
        groups,
        SCREEN_MAX_CHUNKS,
        fit
          ? {
              fit,
              textOf: (c: DeckChunk) => c.part.text,
              /* A paragraph too tall for one screen is SHOWN across several
                 (founder 2026-09-17, overruling the never-split rule shipped
                 the same day): scrolling inside a screen is the thing that
                 read as being stuck. Only the DISPLAY text differs per piece
                 — identity, full text and therefore every control stay whole,
                 so the bookmark and Lock repeat on each screen and each still
                 acts on the entire paragraph. */
              sliceOf: (c, text, index, count) => ({
                ...c,
                displayText: text,
                sliceIndex: index,
                sliceCount: count,
              }),
            }
          : null,
      ),
    [groups, fit],
  );
  const railSlides = useMemo(() => {
    const out: { slideIndex: number | null; first: number; count: number }[] =
      [];
    screens.forEach((s, i) => {
      const last = out[out.length - 1];
      if (last && last.slideIndex === s.slideIndex) last.count += 1;
      else out.push({ slideIndex: s.slideIndex, first: i, count: 1 });
    });
    return out;
  }, [screens]);

  // The open modal is addressed by PART ID, not by object: an accept
  // reassembles the document underneath the modal, and re-deriving the chunk
  // on every render is what carries the fresh words in.
  /* THE OPEN SHEET, remembered by id AND by position + words.
     The id alone is not stable — see resolveOpenChunk — and a sheet that
     vanishes mid-decision is the bug this carries the extra two fields for. */
  const [openPart, setOpenPart] = useState<OpenChunkRef | null>(null);
  /* A STABLE KEY FOR ONE OPENING. Keying the sheet on the live part id meant
     a re-mint remounted it, which throws away anything typed into the draft.
     The sheet already re-syncs its draft when the served words change under
     it ("never over something the student has typed"), so it does not need
     the remount to show fresh words — only a fresh PARAGRAPH needs a fresh
     instance, and that is exactly when this counter moves. */
  const openSeqRef = useRef(0);
  const [openSeq, setOpenSeq] = useState(0);
  const openParagraph = useCallback((chunk: DeckChunk) => {
    openSeqRef.current += 1;
    setOpenSeq(openSeqRef.current);
    setOpenPart({
      id: chunk.part.id,
      index: chunk.paragraphIndex,
      text: chunk.part.text.trim(),
    });
  }, []);
  const [editingSlideIndex, setEditingSlideIndex] = useState<
    number | null | undefined
  >(undefined);
  useEffect(() => {
    if (deckReady) return;
    setOpenPart(null);
    setEditingSlideIndex(undefined);
  }, [deckReady]);
  const openChunk = resolveOpenChunk(chunks, openPart);
  const openState = openChunk ? stateOf(openChunk) : null;

  /* ── NESTED SCROLL (SPEC §11.3, founder 2026-08-14) ──────────────────────
   *
   * The chunk is the step, the slide is the section. Each slide keeps its
   * own INNER chunk scroller (overscroll-contained, so reaching the last
   * chunk never auto-chains mid-gesture); the OUTER slide track is
   * programmatic-only (overflow-hidden — native scroll on it would bypass
   * the gate through the kicker area). A gesture bubbles up to a slide
   * change ONLY when the inner scroller already stands at the edge the
   * gesture pushes against — `canBubble` — and each bubble needs a FRESH
   * gesture (the armed/re-arm latch below), so trackpad momentum cannot
   * fly through a slide the reader never saw. Backwards entry lands on
   * the previous slide's LAST chunk, exactly where the reader left it.
   *
   * Within a slide, chunk scrolling stays continuous — chunks are ~4 lines
   * each and several fit a viewport, so a hard stop per chunk would fight
   * reading. Touch stays native; desktop wheel deltas are applied directly
   * so the complete overlay can behave as one surface. The §11.3 contract is
   * the boundary gate, and that is stepped.
   */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef<DeckPosition>({ slide: 0, chunk: 0 });
  const wheelGestureRef = useRef<WheelGestureState>(IDLE_WHEEL_GESTURE);
  const touchRef = useRef<{ y: number; consumed: boolean } | null>(null);
  const [atSlide, setAtSlide] = useState(0);
  // NO `atChunk` STATE (2026-08-15). It existed only to re-render the rail's
  // per-chunk ticks, which are gone. The live position stays in `posRef` —
  // the scroll gate, the boundary bubble and the backwards-entry landing all
  // read it there and always did. Keeping a write-only useState would be a
  // re-render on every chunk scrolled, for nothing on screen.
  const [copied, setCopied] = useState(false);

  const counts = useMemo(() => chunkCounts(screens), [screens]);

  const setPosition = useCallback((next: DeckPosition) => {
    posRef.current = next;
    setAtSlide(next.slide);
  }, []);

  const chunkOffsetsOf = (inner: HTMLElement): number[] =>
    Array.from(inner.querySelectorAll<HTMLElement>("[data-chunk]")).map(
      (el) => el.offsetTop
    );

  const goTo = useCallback(
    (raw: DeckPosition) => {
      const next = clampPosition(counts, raw);
      const outer = scrollerRef.current;
      if (outer) {
        outer.scrollTo({
          top: next.slide * outer.clientHeight,
          behavior: "smooth",
        });
      }
      const inner = innerRefs.current[next.slide];
      if (inner) {
        const offsets = chunkOffsetsOf(inner);
        inner.scrollTo({
          top: offsets[next.chunk] ?? 0,
          behavior: "smooth",
        });
      }
      setPosition(next);
    },
    [counts, setPosition]
  );

  // The bubble gate, shared by wheel and touch: may this gesture advance
  // the SLIDE, and if so, from which chunk does the step depart? (From the
  // final chunk going forward, the first going back — so `stepPosition`
  // bubbles rather than stepping within the slide.)
  const tryBubble = useCallback(
    (dir: 1 | -1): boolean => {
      const { slide } = posRef.current;
      const inner = innerRefs.current[slide];
      const edge = inner ? scrollEdge(inner) : "both";
      if (!canBubble(edge, dir)) return false;
      const from: DeckPosition = {
        slide,
        chunk: dir === 1 ? (counts[slide] ?? 1) - 1 : 0,
      };
      const next = stepPosition(counts, from, dir);
      if (next.slide === slide) return true; // the deck's end absorbs it
      goTo(next);
      return true;
    },
    [counts, goTo]
  );

  // Wheel: the complete Ideal Text surface owns one gesture. Trackpad wheel
  // events are applied immediately to the active paragraph scroller; at its
  // edge they accumulate into one slide transition, whose momentum tail is
  // swallowed. This avoids both page leakage and queued smooth animations.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const owner =
      stage.closest<HTMLElement>("[data-ideal-text-wheel-owner]") ?? stage;
    const onWheel = (e: WheelEvent) => {
      // Preserve browser pinch-to-zoom and native scrolling inside a modal,
      // Presentation Mode, export preview or another explicitly native area.
      if (e.ctrlKey) return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest('[role="dialog"], [data-ideal-text-wheel-native]')
      ) {
        return;
      }
      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? stage.clientHeight
            : 1;
      const dy = e.deltaY * unit;
      if (dy === 0) return;
      // Cancel EVERY vertical delta, including the sub-4px momentum tail that
      // previously escaped into the page at an inner edge.
      e.preventDefault();
      const dir: 1 | -1 = dy > 0 ? 1 : -1;
      const { slide } = posRef.current;
      const inner = innerRefs.current[slide];
      const edge = inner ? scrollEdge(inner) : "both";
      const outcome = wheelGestureStep(wheelGestureRef.current, {
        deltaY: dy,
        now: performance.now(),
        innerCanScroll: !canBubble(edge, dir),
      });
      wheelGestureRef.current = outcome.state;
      if (outcome.action === "scroll-inner" && inner) {
        // Direct assignment follows the trackpad one-for-one. `scroll-smooth`
        // used to turn every wheel event into a competing animation, so edge
        // detection lagged behind the user's fingers on long gestures.
        inner.scrollTop += dy;
        return;
      }
      if (outcome.action === "advance-screen") tryBubble(dir);
    };
    owner.addEventListener("wheel", onWheel, { passive: false });
    return () => owner.removeEventListener("wheel", onWheel);
  }, [tryBubble]);

  // Touch: one slide step per gesture, only past a deliberate pull at the
  // edge. Native chunk scrolling is untouched (no preventDefault — the
  // inner scroller's overscroll containment already stops the chain).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onStart = (e: TouchEvent) => {
      touchRef.current = { y: e.touches[0]?.clientY ?? 0, consumed: false };
    };
    const onMove = (e: TouchEvent) => {
      const t = touchRef.current;
      if (!t || t.consumed) return;
      const dy = t.y - (e.touches[0]?.clientY ?? t.y);
      if (Math.abs(dy) < 48) return;
      const dir: 1 | -1 = dy > 0 ? 1 : -1;
      const { slide } = posRef.current;
      const inner = innerRefs.current[slide];
      const edge = inner ? scrollEdge(inner) : "both";
      if (!canBubble(edge, dir)) return;
      t.consumed = true;
      tryBubble(dir);
    };
    const onEnd = () => {
      touchRef.current = null;
    };
    stage.addEventListener("touchstart", onStart, { passive: true });
    stage.addEventListener("touchmove", onMove, { passive: true });
    stage.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      stage.removeEventListener("touchstart", onStart);
      stage.removeEventListener("touchmove", onMove);
      stage.removeEventListener("touchend", onEnd);
    };
  }, [tryBubble]);

  // A reassembly can change the deck's shape under the reader; a rotation
  // changes the slide geometry. Re-clamp and re-seat the outer track.
  //
  // ⚠️ WIDTH-GATED (founder 2026-08-15: "the screen zooms weirdly, the
  // structure doesn't hold"). This re-seated on EVERY window resize, and on
  // iOS the software keyboard IS a resize: opening the chunk editor shrinks
  // the viewport, `seat()` runs, and the track is scrolled to
  // `slide * clientHeight` measured against the SHRUNKEN height — so the deck
  // lands mid-slide. Closing the modal fires it again at yet another height.
  // The structure was not failing to hold; it was being re-seated twice
  // against two wrong measurements.
  //
  // A keyboard changes the height only. A rotation changes the width. So the
  // width is what re-seating keys on, and a height-only resize is ignored —
  // the track's own layout absorbs it, which is what it did before the
  // keyboard ever appeared.
  /** The first screen carrying something the speaker has not seen, or null.
   *
   *  COMING BACK FROM THE EMAIL (founder 2026-09-16, §8). Until now the deck
   *  opened wherever it was left and the only clue was a dot on the mark, so
   *  someone following an email hunted slide by slide for the one paragraph
   *  that had changed. The unread signal was already here, one screen at a
   *  time; this reads the same map across all of them. */
  const firstUnreadScreen = useMemo(
    () =>
      firstUnreadScreenIndex(
        screens,
        (c) =>
          summaryByParagraph
            .get(c.part.id)
            ?.some((item) => item.hasUnreadCoachUpdate) === true,
      ),
    [screens, summaryByParagraph],
  );
  /* Once per mount, and only after the summary has actually arrived. It must
     not re-seat later: the summary refetches, and a speaker who has scrolled
     away would be yanked back to a paragraph they already dealt with. */
  const seatedUnreadRef = useRef(false);
  useEffect(() => {
    if (seatedUnreadRef.current || firstUnreadScreen === null) return;
    seatedUnreadRef.current = true;
    const clamped = clampPosition(counts, {
      ...posRef.current,
      slide: firstUnreadScreen,
      chunk: 0,
    });
    posRef.current = clamped;
    setAtSlide(clamped.slide);
    const outer = scrollerRef.current;
    if (outer) outer.scrollTo({ top: clamped.slide * outer.clientHeight });
  }, [firstUnreadScreen, counts]);

  /* RETURN TO THE SLIDE AFTER A DECISION (founder 2026-09-17, locked).
   *
   * "After you lock: return to the slide, scrolled to that paragraph." The
   * sheet used to close onto wherever the deck happened to be standing,
   * which after a reassembly could be a different paragraph entirely — the
   * speaker settled one thing and was put down somewhere else.
   *
   * Held as a PART ID and resolved against the CURRENT screens, not as a
   * position captured at lock time. A lock recomposes the served text and
   * rebuilds the screens, so the paragraph can move; an index captured
   * beforehand would point at whatever slid into that slot.
   *
   * It waits, rather than firing once: the landing runs on every screens
   * change until the paragraph is actually found, then clears itself. That
   * is what makes it survive the refetch the lock triggers — the id is
   * simply not in the deck for the frames in between. If it never appears
   * (deleted, merged away) the request is dropped at unmount and the reader
   * is left where they are, which is the honest answer to "that paragraph
   * is gone" and better than a jump to the top. */
  const [landOnPart, setLandOnPart] = useState<string | null>(null);
  useEffect(() => {
    if (!landOnPart) return;
    const at = screenPositionOfPart(screens, landOnPart);
    if (!at) return;      // not rebuilt yet — try again when screens change
    setLandOnPart(null);
    goTo(at);
  }, [landOnPart, screens, goTo]);

  /* MEASURE THE SCREEN, THEN REPACK (founder 2026-09-17).
   *
   * The packing rule is pure and lives in deckScroll; this is the only part
   * that has to touch the DOM, because every number it needs is variable: the
   * chunk type is clamp()d to the viewport, the line height is a ratio of it,
   * the column width moves with the breakpoint, and the height left for words
   * depends on whether the slide above them rendered at all.
   *
   * It runs after layout and measures EVERY mounted screen, keeping the
   * tightest (founder 2026-09-19: "the large slide that should have been
   * truncated into two slides is not"). It used to measure only the active
   * screen and pack the whole document to that one number, which is correct
   * exactly while every screen is the same height — and stopped being so the
   * moment the slide picture came back, because a first screen carries one
   * and a continuation screen does not. Measured on a continuation, the
   * budget was a slide too tall and the split silently stopped happening.
   * `tightestFit` makes the asymmetry harmless whatever the headers do next.
   *
   * It only adopts a fit that `fitChangedMeaningfully` accepts. That guard is
   * load-bearing rather than tidy: repacking changes the screens, which
   * re-renders, which measures again — so a fit jittering by a fraction of a
   * pixel (a scrollbar appearing, sub-pixel line height, iOS rounding the
   * viewport as the URL bar slides) would repack forever. A change too small
   * to move a paragraph onto a different screen is not a change.
   *
   * A failed measurement leaves `fit` null and the deck keeps the fixed count
   * of three it always had — never a blank screen waiting on a number. */
  useEffect(() => {
    if (!deckReady) return;
    const remeasure = () => {
      const next = tightestFit(
        innerRefs.current.map((scroller) =>
          measureScreenFit(
            scroller ?? null,
            scroller?.querySelector<HTMLElement>("[data-chunk]") ?? null,
          ),
        ),
      );
      if (!next) return;
      setFit((prev) => (fitChangedMeaningfully(prev, next) ? next : prev));
    };
    remeasure();
    window.addEventListener("resize", remeasure);
    return () => window.removeEventListener("resize", remeasure);
  }, [deckReady, screens]);

  /* THE KEYS ARE LIVE ON OPEN (founder 2026-09-22). The handler lives on the
   * stage, so until something focused it every arrow press went to the page
   * instead — the reader presses once, nothing happens, and the control
   * looks broken rather than unfocused.
   *
   * Only ever from the body: if the reader has already reached for a field,
   * a button or the sheet, their focus is theirs and taking it would be the
   * worse bug. `preventScroll` because focusing a tall stage otherwise jumps
   * the page to it, undoing the position the deck just restored. */
  useEffect(() => {
    if (!deckReady) return;
    const stage = stageRef.current;
    if (!stage) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    stage.focus({ preventScroll: true });
  }, [deckReady]);

  const seatWidthRef = useRef(-1);
  useEffect(() => {
    const seat = () => {
      const clamped = clampPosition(counts, posRef.current);
      posRef.current = clamped;
      setAtSlide(clamped.slide);
      const outer = scrollerRef.current;
      if (outer) outer.scrollTo({ top: clamped.slide * outer.clientHeight });
    };
    seatWidthRef.current = window.innerWidth;
    seat();
    const onResize = () => {
      if (window.innerWidth === seatWidthRef.current) return;  // keyboard
      seatWidthRef.current = window.innerWidth;
      seat();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [counts]);


  const kickerFor = (slideIndex: number | null, ord: number): string =>
    slideIndex === null ? "Your talk" : `Slide ${slideIndex + 1}`;
  const titleFor = (slideIndex: number | null): string | null =>
    slideIndex === null ? null : (slideTitles?.[slideIndex] ?? null);

  async function copyDeck() {
    // The whole deck: kicker/title + paragraphs, slides separated by a rule
    // (Lovable §4's copy tool).
    const textOut = groups
      .map((g, i) => {
        const head = [kickerFor(g.slideIndex, i), titleFor(g.slideIndex)]
          .filter(Boolean)
          .join(" — ");
        const body = g.chunks.map((c) => c.part.text).join("\n\n");
        return `${head}\n\n${body}`;
      })
      .join("\n\n———\n\n");
    try {
      await navigator.clipboard.writeText(textOut);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused (permissions) — the button simply doesn't confirm.
    }
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-background"
      {...linkageAttrs(grouping, chunks, piecePartIds)}
    >
      {/* Header — title, status chip, copy and close ONLY (Lovable §4). */}
      {chrome === "full" ? (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">
            {title}
          </span>
          {statusChip ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {statusChip}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {deckReady ? (
            <button
              type="button"
              onClick={() => void copyDeck()}
              aria-label="Copy the whole text"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
          {onClose ? (
            <OverlayCloseButton onClick={onClose} ariaLabel="Close the deck" />
          ) : null}
        </span>
      </div>
      ) : null}

      {/* Stage — one slide per viewport; chunks scroll INSIDE the slide
          first, the slide advances only from its final chunk (§11.3) for
          WHEEL AND TOUCH. The keyboard steps one whole SCREEN — see the
          handler. */}
      <div
        ref={stageRef}
        tabIndex={deckReady ? 0 : -1}
        onKeyDown={(e) => {
          if (!deckReady) return;
          const fwd =
            e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ";
          const back = e.key === "ArrowUp" || e.key === "PageUp";
          if (!fwd && !back) return;
          e.preventDefault();
          /* ONE PRESS, ONE SCREENFUL (founder 2026-09-22: "on the keyboard
             if I click it it scrolls one slide").

             It used to step one CHUNK, which mostly moved nothing. Screens
             are packed to FIT since 2026-09-17 — every chunk on a screen is
             already visible — so scrolling the inner scroller to the next
             chunk's offset had nowhere to go. Only the last press of a
             screen did anything, and the ones before it read as the arrow
             key being ignored.

             So the keyboard addresses the screen, which is the unit a
             reader actually sees, and lands on its top. Wheel and touch are
             untouched: they still run the §11.3 chunk gate, because a
             continuous gesture has to be able to stop between chunks and a
             key press does not. */
          goTo({ slide: posRef.current.slide + (fwd ? 1 : -1), chunk: 0 });
        }}
        className="relative min-h-0 flex-1 outline-none"
      >
        <div
          ref={scrollerRef}
          // PROGRAMMATIC-ONLY (§11.3): native scroll on the slide track
          // would bypass the chunk gate through the kicker area, so the
          // track only moves via goTo/dots/keys.
          className={deckReady ? "h-full overflow-hidden" : "hidden"}
        >
          {screens.map((g, gi) => (
            <section
              key={`${g.slideIndex ?? "untitled"}-${g.screenOfSlide}`}
              // NO RULE BETWEEN SLIDES (founder 2026-08-11: "the screen has
              // a stroke around the text, please delete that all"). One
              // slide fills the viewport; a dashed line under each one drew
              // a box around the words for a boundary the scroll already
              // makes.
              className="flex h-full flex-col gap-4 px-6 py-8 sm:px-10"
            >
              <div className="shrink-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {kickerFor(g.slideIndex, gi)}
                </p>
                {/* NO SLIDE TITLE HEADING (founder 2026-09-17: "delete the
                    header marked on the photo from each slide display; too
                    much is going on this screen when we have the slide and
                    the title"). The picture of the slide IS the title — it
                    is printed on it, usually in the deck's own type — so the
                    heading restated it directly above, in a second typeface,
                    at display size. Two of the four things on screen said the
                    same word, and the speaker's own sentences were the ones
                    pushed down for it.

                    The kicker above ("Slide 1") stays: it says WHERE you are,
                    which the picture cannot. The title is still carried
                    everywhere it is not redundant — the slide editor's
                    header, and the deck's copy output, where there is no
                    picture to read it from. */}
                {/* THE SLIDE REPEATS ON EVERY SCREEN IT SPANS (founder
                    2026-09-19: "it should just repeat the slide and render
                    the rest of the text there"). It used to draw only on
                    `screenOfSlide === 0`, which meant the continuation of a
                    long slide showed words with no picture above them — the
                    reader lost the thing the words are about halfway through
                    reading them.

                    It is also what makes the measurement honest: with the
                    picture on screen 0 only, a first screen and a
                    continuation had different amounts of room, and one
                    measured budget could not be right for both. Same header
                    everywhere, one budget, and `tightestFit` to catch it if
                    that ever stops being true.

                    The document is unchanged by this: `screensInSlide` and
                    the kicker already say "Slide N" on each screen, so no
                    new copy is surfaced.

                    NO `presentationRef` GUARD (founder 2026-09-19). A
                    deckless project owns the canonical mock slides, and
                    `DeckSlidePreview` serves both kinds; gating here was
                    what made the same document read two different ways
                    depending on whether a PDF had been uploaded. */}
                {g.slideIndex !== null ? (
                  <DeckSlidePreview
                    presentationRef={presentationRef}
                    pageIndex={g.slideIndex}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditingSlideIndex(g.slideIndex)}
                  className="mt-3 text-[13px] font-medium text-primary transition-opacity hover:opacity-70"
                >
                  Edit the text
                </button>
              </div>
              {/* The INNER chunk scroller: overscroll-contained so the
                  last chunk never chains into a slide flip mid-gesture —
                  the bubble is a deliberate step, taken above. `my-auto`
                  centres a short slide exactly as the old layout did and
                  collapses to 0 the moment the chunks overflow (the old
                  justify-center CLIPPED overflowing text — screenshot #1's
                  second defect). */}
              <div
                ref={(el) => {
                  innerRefs.current[gi] = el;
                }}
                onScroll={(e) => {
                  if (gi !== posRef.current.slide) return;
                  const el = e.currentTarget;
                  const chunk = nearestChunkIndex(
                    chunkOffsetsOf(el),
                    el.scrollTop
                  );
                  if (chunk !== posRef.current.chunk) {
                    // REF ONLY — no setState (2026-08-15). This tracking is
                    // load-bearing: the boundary gate and the backwards-entry
                    // landing both read `posRef.current.chunk`. What it no
                    // longer needs to do is RE-RENDER, because the rail
                    // stopped drawing a tick per chunk. Scrolling a screen
                    // used to re-render the whole deck on every paragraph
                    // crossed, to move a dot the reader was not looking at.
                    posRef.current = { slide: gi, chunk };
                  }
                }}
                className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
              >
                {/* THE WORDS START AT THE TOP (founder 2026-09-17: "this
                    screen misalignment, it is impossible to work that way").
                    They used to be vertically CENTRED in the scroller, which
                    looked deliberate only when a slide happened to fill it.
                    On a short screen — or any screen whose slide preview is
                    missing — the header sat at the top, the paragraphs floated
                    in the middle, and a band of empty page opened above and
                    below them. Nothing was broken; it read as broken, and it
                    moved every time the content changed height.

                    Top alignment makes the position of the first line a
                    constant: it is always directly under the header, on every
                    screen, whatever is or is not above it. */}
                <div className="flex flex-col gap-4">
                  {g.chunks.map((c) => {
                    const st = stateOf(c);
                    /* DOCUMENT STATE (contract 24g-1). A block holding an
                       UNSETTLED judgement is softened; a settled one — locked
                       or clean alike — is the ordinary text colour with no
                       mark at all. There is no third "done" state: the clean
                       text IS the settled state, so the document empties as
                       the speaker works instead of accumulating marks.

                       GREY FOLLOWS THE MARK, one condition for both (founder
                       2026-09-18: "the grey should be when there is a mark").
                       Keyed on `status === "waiting"` these could disagree —
                       the mark is drawn only for a Confident Voice judgement
                       (2026-09-17: a column of identical marks down a talk
                       teaches the eye to skip them), while any undecided item
                       greys the block. That gap is grey text with nothing to
                       tap.

                       It is also unreachable by design, which is why one
                       condition is safe rather than a narrowing: 24f anchors
                       the rewrite and the praise TO a Confident Voice item
                       instead of standing them up as their own cards, so a
                       block cannot hold a rewrite without the judgement that
                       carries it. Founder: "the rewrite only happens after the
                       judgement". Sharing the condition makes that structural
                       fact impossible to contradict on screen.

                       AT BLOCK LEVEL, NEVER AT WORD LEVEL. The class sits on
                       the whole paragraph element, so no sentence changes
                       colour midway and no gap can open inside a word.

                       The two signals are the softened block and the
                       bookmark, and nothing else: no underline, no highlight,
                       no badge on the text. */
                    const unsettled =
                      c.status === "waiting" &&
                      markWorthShowing(
                        st.pending,
                        summaryByParagraph.get(c.part.id),
                      );
                    return (
                    <p
                      key={`${c.part.id}:${c.sliceIndex ?? 0}`}
                      data-chunk
                      data-settled={unsettled ? undefined : "true"}
                      data-untouched={c.status === "untouched" ? "true" : undefined}
                      className={`text-[clamp(1.02rem,2.5vw,1.22rem)] leading-[1.8] ${
                        /* UNTOUCHED READS GREY TOO (founder 2026-09-21), and
                           without a mark: nothing was ever done with these
                           words, and the page says so instead of drawing
                           them like a reviewed paragraph. */
                        unsettled || c.status === "untouched"
                          ? "text-foreground/55"
                          : "text-foreground"
                      }`}
                    >
                      {/* DISPLAY TEXT, which is the whole paragraph unless it
                          was too tall for one screen and got split across
                          several. Only the words on THIS screen are drawn;
                          `c.part.text` — what every control acts on — is
                          untouched. */}
                      <RichText
                        text={c.displayText ?? c.part.text}
                        tint={
                          partRootTint(c.part) ?? (() => {
                            const marker = summaryByParagraph.get(c.part.id)?.[0];
                            const bundle = marker
                              ? confidentMoments.projection?.bundles.find(
                                  (candidate) => candidate.bundleId === marker.bundleId,
                                )
                              : null;
                            return bundle
                              ? bundleRootTint(
                                  c.part.text,
                                  bundle.root,
                                  bundle.feedbackLanguageItems
                                    .filter((item) => item.attachedCandidateId === bundle.bundleId)
                                    .map((item) => item.sourcePassage.text),
                                )
                              : undefined;
                          })()
                        }
                      />
                      {/* THE MARK IS FOR THE CONFIDENT VOICE QUESTION
                          (founder 2026-09-17: "show it only when there is a
                          confident voice judgement waiting under that
                          bookmark").

                          A mark at the end of every paragraph is a column of
                          identical icons down the length of a talk, which
                          reads as decoration and teaches the eye to skip the
                          ones that mean something.

                          VISIBILITY ONLY. Nothing behind the mark changes —
                          the sheet, the ladder, the lock and the inventory are
                          untouched, and every item the Manager approved is
                          still there when it opens. */}
                      {unsettled ? (
                      <DeckLockMark
                        status={c.status}
                        tier={c.tier}
                        flagship={summaryByParagraph.get(c.part.id)?.some((item) => item.isOrange) === true || Boolean(c.part.rootPhrase) || parseRichSpans(c.part.text).some(
                          (span) => span.highlight && span.text.trim().length > 0
                        )}
                        onClick={() => {
                          const markers = summaryByParagraph.get(c.part.id) ?? [];
                          if (markers.length > 0) {
                            const index = paragraphBundleCursor[c.part.id] ?? 0;
                            setOpenBundleId(markers[index % markers.length].bundleId);
                            setParagraphBundleCursor((current) => ({
                              ...current,
                              [c.part.id]: (index + 1) % markers.length,
                            }));
                          } else openParagraph(c);
                        }}
                        // THE COACH'S MESSAGE, VISIBLE FROM THE LOCK (founder
                        // 2026-08-11). The same join the modal already runs,
                        // now run per chunk so the page can say WHICH chunk
                        // carries it. Free: `coachMomentForChunk` is a pure
                        // anchor lookup over the served document, and the
                        // metered feedback read still fires only on the tap
                        // inside the modal.
                        hasCoach={
                          summaryByParagraph.get(c.part.id)?.some((item) => item.hasCoachUpdate) === true ||
                          st.coach.hasFeedback
                        }
                        hasUnreadCoachUpdate={
                          summaryByParagraph.get(c.part.id)
                            ?.some((item) => item.hasUnreadCoachUpdate) === true
                        }
                        reviewStatus={st.coach.reviewStatus}
                        // THE STYLE LANE'S HANDLE (founder 2026-08-12). Same
                        // shape as the coach dot, and for the same reason: the
                        // proposal lives only inside the modal, so without a
                        // mark on the page the only way to find it is to open
                        // every locked chunk in turn. `styleFor` is the pure
                        // overlap the modal already runs on the open chunk —
                        // run per chunk here, it costs one span comparison.
                        hasStyle={st.style !== null}
                      />
                      ) : feedbackPending ? (
                        /* THE SLOT IS RESERVED WHILE FEEDBACK IS STILL COMING
                           (founder 2026-09-17: "when it comes to delayed
                           appearance, please fix it too, it's very
                           important").

                           The page paints from the core read, then asks for
                           feedback in a SECOND request — and a third while the
                           server settles it. So a finished-looking talk stood
                           with no marks on it, and the marks then appeared and
                           shoved the words sideways. Two separate problems in
                           one: the page looked complete when it was not, and
                           the layout moved under the reader's eye.

                           This fixes the second and is honest about the first:
                           an empty box of exactly the mark's footprint holds
                           the place, so the real mark fades into a space
                           already made for it and no text moves. It is not a
                           mark — it carries no state, no ring and no tap, and
                           it cannot say whether this paragraph will get one,
                           because at this moment nothing knows. It says only
                           "not finished here yet", which is true. */
                        /* IT SPINS (founder 2026-09-22: "can we make it
                           spin?"). A pulsing disc reads as a mark that has
                           not finished fading in — something about to be
                           there. A rotating arc reads as work in progress,
                           which is what this actually is: the Manager has
                           not answered for this paragraph yet.

                           Same 28px footprint and the same place in the
                           line, so it still holds the mark's space exactly
                           and the words do not move when the real mark
                           lands. It remains aria-hidden and untappable —
                           it carries no state and cannot say whether this
                           paragraph will get a mark at all. Under
                           `prefers-reduced-motion` it simply sits still. */
                        <span
                          aria-hidden
                          data-feedback-slot
                          className="ml-1.5 inline-block h-7 w-7 shrink-0 rounded-full border-2 border-muted/30 border-t-muted-foreground/45 align-middle motion-safe:animate-spin [animation-duration:1.1s]"
                        />
                      ) : null}
                    </p>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* THE RAIL — TWO GRAINS, PAGES PER SLIDE (§11.4, re-cut
            2026-08-15). The pill is the SLIDE; each mark inside it is one
            SCREEN of that slide, the current one stretched. A slide that
            runs onto a second screen therefore shows two marks — which is
            the whole read: where am I, and how much of this slide is left.
            The former third grain (a tick per chunk inside the active
            screen) is gone; see the mark below for why.
            POSITION ONLY — "slide 3, second of two screens" is navigation;
            the rail must never grade (AC-9). */}
        {deckReady &&
        (screens.length > 1 || (counts[0] ?? 0) > 1) ? (
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2.5">
            {railSlides.map((rs, ord) => {
              const slideScreens = screens.slice(rs.first, rs.first + rs.count);
              const marks = slideScreens.map((scr, k) => {
                const si = rs.first + k;
                const label =
                  scr.screensInSlide > 1
                    ? `Go to ${kickerFor(rs.slideIndex, ord)}, screen ${
                        scr.screenOfSlide + 1
                      } of ${scr.screensInSlide}`
                    : `Go to ${kickerFor(rs.slideIndex, ord)}`;
                // ONE MARK PER SCREEN — no chunk ticks (founder 2026-08-15:
                // "just the pages per slide … one level of hierarchy can be
                // removed, this deepest one").
                //
                // The active screen used to expand into a capsule holding one
                // tick per chunk, which made the rail read at three grains at
                // once: pill = slide, mark = screen, tick = chunk. Two of
                // those answer "where am I"; the third answered "which
                // paragraph is under my thumb", which the reader can already
                // see — the paragraphs are RIGHT THERE on the screen it was
                // describing. It cost the rail its glanceability to restate
                // what the page already showed.
                //
                // Nothing is lost from navigation: chunk scrolling inside a
                // screen is native and continuous (§11.3), so there was never
                // a step for those ticks to be the control for. The live
                // chunk position stays in `posRef`, where the scroll gate and
                // the backwards-entry landing already read it.
                return (
                  <button
                    key={`scr-${si}`}
                    type="button"
                    aria-label={label}
                    aria-current={atSlide === si ? "true" : undefined}
                    onClick={() => goTo({ slide: si, chunk: 0 })}
                    className={`rounded-full transition-all ${
                      atSlide === si
                        ? "h-[1.1rem] w-2 bg-foreground"
                        : "h-2 w-2 bg-muted-foreground/40 hover:bg-muted-foreground"
                    }`}
                  />
                );
              });
              // §11.7.3: a multi-screen slide's marks share one pill — the
              // continuation is VISIBLE on the rail. The pill is the SLIDE,
              // its marks are that slide's SCREENS, and that is now the whole
              // rail. Position only, never a grade (AC-9).
              return rs.count > 1 ? (
                <div
                  key={rs.slideIndex ?? `rail-${ord}`}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 px-[3px] py-1.5"
                >
                  {marks}
                </div>
              ) : (
                <div
                  key={rs.slideIndex ?? `rail-${ord}`}
                  className="flex flex-col items-center"
                >
                  {marks}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* NO FOOTER (founder 2026-08-11). The review count, the slide
          position and the word count are all gone: the dots rail already
          says where you are, and a running word count is a number about
          your speech sitting under your speech. */}

      {deckReady && openChunk && openState ? (
        <DeckChunkModal
          key={openSeq}
          state={openState}
          onAccept={onAccept}
          onUndoAccept={onUndoAccept}
          onKeepMine={onKeepMine}
          onJudged={onJudged}
          onLockIn={async (text: string): Promise<LockResult> => {
            const result = await onLockPart(openChunk, text);
            if (result.outcome === "ok") {
              // Founder 2026-09-17: after a lock, return to the slide,
              // scrolled to that paragraph. Requested by id — the lock
              // reassembles the document, so where it lands is only known
              // once the screens have been rebuilt.
              setLandOnPart(openChunk.part.id);
              // §11.7.1: the page shows the lock the instant the server
              // confirms it — the modal closes itself on "ok".
              setOptimisticLocked((prev) =>
                new Set(prev).add(openChunk.part.id)
              );
            }
            return result;
          }}
          onKeepEvolving={(text) => onKeepEvolving(openChunk, text)}
          onSetRootPhrase={(phrase) => onSetRootPhrase(openChunk, phrase)}
          onDocumentChanged={onConfidentMomentChanged}
          onUnlockPart={
            onUnlockPart
              ? async (): Promise<LockOutcome> => {
                  const outcome = await onUnlockPart(openChunk);
                  if (outcome === "ok") {
                    // Mirror of the lock's optimism: the mark greys the
                    // instant the server confirms, instead of waiting on the
                    // host's refetch. Clearing the id is enough — the base
                    // status is derived from the served part, which the
                    // refetch will report unlocked anyway.
                    setOptimisticLocked((prev) => {
                      const next = new Set(prev);
                      next.delete(openChunk.part.id);
                      return next;
                    });
                    setOptimisticUnlocked((prev) =>
                      new Set(prev).add(openChunk.part.id)
                    );
                  }
                  return outcome;
                }
              : null
          }
          onClose={() => setOpenPart(null)}
          onApplyStyle={onApplyStyle}
          arcId={arcId}
          firstTake={takeCount === 1}
        />
      ) : null}
      {deckReady && editingSlideIndex !== undefined ? (
        <SlideEditor
          key={editingSlideIndex ?? "unlinked"}
          title={titleFor(editingSlideIndex) || kickerFor(editingSlideIndex, 0)}
          presentationRef={presentationRef}
          slideIndex={editingSlideIndex}
          chunks={
            groups.find((group) => group.slideIndex === editingSlideIndex)
              ?.chunks ?? []
          }
          onCancel={() => setEditingSlideIndex(undefined)}
          onSave={async (edits) => {
            const saved = await onEditSlide(edits);
            if (saved) setEditingSlideIndex(undefined);
            return saved;
          }}
        />
      ) : null}
      {openBundle ? (
        <ConfidentMomentCoachingBundle
          bundle={openBundle}
          documentSnapshotId={confidentMoments.projection!.documentSnapshotId}
          ownerEdit={confidentMomentOwnerEdit}
          onChanged={() => {
            confidentMoments.refresh();
            onConfidentMomentChanged?.();
          }}
          onClose={() => setOpenBundleId(null)}
        />
      ) : null}
    </div>
  );
}

function SlideEditor({
  title,
  presentationRef,
  slideIndex,
  chunks,
  onCancel,
  onSave,
}: {
  title: string;
  presentationRef: string | null;
  slideIndex: number | null;
  chunks: readonly DeckChunk[];
  onCancel: () => void;
  onSave: (edits: Array<{ chunk: DeckChunk; text: string }>) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState(() => chunks.map((chunk) => chunk.part.text));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Edit the text"
    >
      <div className="flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Edit the text
          </p>
          <h2 className="mt-1 text-[17px] font-semibold text-foreground">{title}</h2>
        </div>
        <div className="scrollbar-none flex flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Same rule as the deck above: the slide editor shows whichever
              deck this project has, uploaded or canonical. */}
          {slideIndex !== null ? (
            <DeckSlidePreview
              presentationRef={presentationRef}
              pageIndex={slideIndex}
              className=""
            />
          ) : null}
          {chunks.map((chunk, index) => (
            <MarkedEditor
              key={chunk.part.id}
              value={drafts[index] ?? ""}
              onChange={(next) =>
                setDrafts((current) =>
                  current.map((value, at) =>
                    at === index ? next : value
                  )
                )
              }
              toolbar={false}
              textSizeClass="text-[16px]"
              frameClass="min-h-32 border border-border bg-background focus-within:border-primary"
            />
          ))}
          {failed ? (
            <p className="text-[12px] text-destructive">
              Couldn&apos;t save this slide. Your edits are still here.
            </p>
          ) : null}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 px-5 pb-5 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="rounded-full">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || drafts.some((draft) => !draft.trim())}
            onClick={() => {
              setSaving(true);
              setFailed(false);
              void onSave(
                chunks.flatMap((chunk, index) =>
                  drafts[index]?.trim() !== chunk.part.text.trim()
                    ? [{ chunk, text: drafts[index].trim() }]
                    : []
                )
              ).then((ok) => {
                setSaving(false);
                setFailed(!ok);
              });
            }}
            className="rounded-full"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
