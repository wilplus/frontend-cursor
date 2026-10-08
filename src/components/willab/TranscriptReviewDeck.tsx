"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import DeckChunkModal, {
  type LockResult,
} from "@/components/willab/DeckChunkModal";
import OpenChunkSheet from "@/components/willab/OpenChunkSheet";
import DeckSlideThumb from "@/components/willab/DeckSlideThumb";
import { WalkEndLayer } from "@/components/willab/WalkEnd";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";
import {
  bookmarkPartIds,
  buildBookmarks,
  helperWordsDeleted,
  opensFromPage,
  useFeedbackPager,
  type Bookmark,
} from "@/components/willab/feedbackPager";
import {
  helperWordRanges,
  opensParagraphSheet,
} from "@/lib/willab/answeredBookmark";
import {
  headlineFor,
  useDroppedHeadlines,
  useHeadlinesWithPending,
} from "@/components/willab/useSlideHeadlines";
import type { RootPhraseSpan } from "@/services/api/partLock";
import DeckLockMark from "@/components/willab/DeckLockMark";
import MarkedEditor from "@/components/willab/MarkedEditor";
import { RichText } from "@/components/willab/RichText";
import { parseRichSpans } from "@/lib/willab/richMarkers";
import {
  buildChunkStates,
  buildDeckChunks,
  withoutUnhearableJudgements,
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
  allowForHidden,
  fitChangedMeaningfully,
  hiddenBelow,
  measureScreenFit,
  tightestFit,
  type OverflowAllowance,
} from "@/lib/willab/measureScreenFit";
import { type Part } from "@/lib/willab/documentParts";
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
import {
  deleteHelperWordsBehind,
  helperWordsBehind,
  helperWordsFromTakeBehind,
  useSaveBehind,
} from "./saveBehind";
import { usePrefetchParagraphSheets } from "./paragraphSheetData";
import { CoachStepLayer } from "./CoachMessageSheet";
import { useCoachStep } from "./useCoachStep";
import { useDeckFeedbackWalk, useWalkReplayRequest, walkFinished } from "./useDeckFeedbackWalk";
import type { CoachMessage } from "@/services/api/idealText";

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

/** The open sheet's paragraph: the live id, which an accept may have
 *  re-minted, else the one it opened with; null when no sheet is open. */
function liveOpenPartId(
  openPart: { id: string } | null,
  openChunk: { part: { id: string } } | null | undefined,
): string | null {
  if (!openPart) return null;
  return openChunk?.part.id ?? openPart.id;
}

export default function TranscriptReviewDeck({
  title = "",
  statusChip = null,
  chrome = "full",
  document: doc,
  parts,
  suggestions: servedSuggestions,
  pieceSlideIndexes,
  piecePartIds = null,
  slideTitles,
  presentationRef = null,
  onAccept,
  onUndoAccept,
  onKeepMine,
  onJudged,
  onLockPart,
  onUnlockPart = null,
  onSetRootPhrase,
  onSetHelperWordsFromTake = null,
  onEditSlide,
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
  openFeedback = false,
  coachMessage = null,
  reviewRequest = 0,
  onReviewWaiting,
  replayRequest,
  onReplayReady,
  renderNextStep,
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
  /** Lift the lock (founder lock 2026-09-30, D4: Delete clears the words
   *  and the lock). Absent → Delete clears the words alone. */
  onUnlockPart?: ((chunk: DeckChunk) => Promise<boolean>) | null;
  onSetRootPhrase: (
    chunk: DeckChunk,
    phrase: RootPhraseSpan | null,
  ) => Promise<boolean>;
  /** Helper words from an earlier Take (B4, D5), stored on the Slide.
   *  Absent → the overlay shows earlier Takes' words but cannot use them. */
  onSetHelperWordsFromTake?: (
    (chunk: DeckChunk, phrase: string, takeIndex: number) => Promise<boolean>
  ) | null;
  /** Save only the current slide's changed paragraphs in one atomic document
   *  edit; all other slides remain byte-for-byte unchanged. */
  onEditSlide: (
    edits: Array<{ chunk: DeckChunk; text: string }>
  ) => Promise<boolean>;
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
  /** Open on the coach's feedback once the deck is ready: the email link and
   *  the chat bubble (founder 2026-09-25, Q28 A). */
  openFeedback?: boolean;
  /** The coach's overall message: step 0 of the Feedback sheet (founder
   *  2026-09-29, Q1; Final Screens L8). */
  coachMessage?: CoachMessage | null;
  /** Bumped by the host's "Review feedback" button: open the walk at the
   *  first waiting moment in text order (founder 2026-09-26). */
  reviewRequest?: number;
  /** Whether any moment still waits for the speaker — the host's bottom
   *  button reads it to offer Review feedback or the next take. */
  onReviewWaiting?: (waiting: boolean) => void;
  /** Bumped by the host's "Review feedback" link under "Record Take N":
   *  play the finished walk again (founder 2026-10-08, Q-IT643b A). */
  replayRequest?: number;
  /** Whether the finished walk can be played again — the host offers the
   *  link only then. */
  onReplayReady?: (ready: boolean) => void;
  /** The host's next step (the next take, or See next steps), drawn on the
   *  card after the last moment of the walk. Absent → the card offers only
   *  the way back to the text. */
  renderNextStep?: () => React.ReactNode;
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
  useEffect(() => {
    setOptimisticLocked(new Set());
  }, [parts]);

  // A Confident Voice item the speaker cannot hear is not asked (founder
  // 2026-09-29): it leaves the inventory before anything is built from it.
  const suggestions = useMemo(
    () => withoutUnhearableJudgements(servedSuggestions),
    [servedSuggestions],
  );
  const chunks = useMemo(() => {
    const built = buildDeckChunks(doc, parts, suggestions);
    if (optimisticLocked.size === 0) {
      return built;
    }
    return built.map((c) => {
      if ((c.status === "clean" || c.status === "untouched")
          && optimisticLocked.has(c.part.id)) {
        return { ...c, status: "locked" as const };
      }
      return c;
    });
  }, [doc, parts, suggestions, optimisticLocked]);
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
  const hiddenRef = useRef<OverflowAllowance | null>(null);
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
  /* THE PAGE'S HEADLINE OPENS THE HELPER WORDS OVERLAY (founder lock
     2026-09-30, B4): a tap on the orange words opens the paragraph's sheet
     straight on them; any other opening starts on the sheet itself. */
  const [openWords, setOpenWords] = useState(false);
  const openParagraph = useCallback((chunk: DeckChunk) => {
    openSeqRef.current += 1;
    setOpenSeq(openSeqRef.current);
    setOpenWords(false);
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
  const {
    headlines: readHeadlines,
    expect: expectHeadline,
    settle: settleHeadline,
  } = useHeadlinesWithPending(arcId, doc, openPart !== null);
  // A deleted set leaves the page at once (D4).
  const { headlines, drop: dropHeadline } = useDroppedHeadlines(readHeadlines);
  // Deleted here, before the next read says so (N48.2 Q6 A).
  const [deletedHere, setDeletedHere] = useState<ReadonlySet<string>>(() => new Set());
  const openHelperWords = useCallback((chunk: DeckChunk) => {
    openParagraph(chunk);
    setOpenWords(true);
  }, [openParagraph]);
  const openState = openChunk ? stateOf(openChunk) : null;
  /** A paragraph opens its own sheet when no judgement waits on it or its
   *  helper words are saved (founder lock 2026-09-30, B5, B8). */
  const opensOwnSheet = useCallback(
    (c: DeckChunk) => opensParagraphSheet(stateOf(c), headlines.has(c.part.id)),
    [stateOf, headlines],
  );
  // Every save of helper words goes through here, from either sheet, so the
  // chosen words stand in as the headline at once (founder 2026-09-28, 2A).
  const setRootPhrase = useCallback(
    async (chunk: DeckChunk, phrase: RootPhraseSpan | null): Promise<boolean> => {
      if (phrase) expectHeadline(chunk.part.id, phrase.text);
      const ok = await onSetRootPhrase(chunk, phrase);
      if (phrase) settleHeadline(chunk.part.id, ok);
      return ok;
    },
    [onSetRootPhrase, expectHeadline, settleHeadline],
  );
  // The paragraph sheet opens complete: read its data ahead (1A).
  const answeredPartIds = useMemo(
    () => chunks.filter((c) => opensOwnSheet(c)).map((c) => c.part.id),
    [chunks, opensOwnSheet],
  );
  // After a close only that paragraph is read again (F5): the live id,
  // which an accept may have re-minted, else the one it opened with.
  usePrefetchParagraphSheets(
    arcId,
    takeSessionId,
    answeredPartIds,
    liveOpenPartId(openPart, openChunk),
  );

  /* BACK / NEXT ACROSS THE BOOKMARKS (founder 2026-09-25, Q29 A–Q32 A). Every
     bookmark of the Take in text order; a coach moment opens the coaching
     sheet, everything else the paragraph's own sheet. */
  const bookmarks = useMemo(
    () =>
      buildBookmarks(
        chunks,
        (c) => {
          const st = stateOf(c);
          return { pending: st.pending.length, decided: st.decided.length };
        },
        (id) => summaryByParagraph.get(id),
        // A paragraph with saved helper words is a screen of the walk,
        // passed with Next (founder lock 2026-09-30, B8).
        (c) => headlines.has(c.part.id),
        // After Delete it rejoins the walk at once on its earlier answer
        // (founder 2026-10-05, N48.2 Q6 A).
        (c) => helperWordsDeleted(c.part, deletedHere.has(c.part.id), headlines.has(c.part.id)),
      ),
    [chunks, stateOf, summaryByParagraph, headlines, deletedHere],
  );
  // Only a bookmark opens on tap (founder 2026-10-06, N56.5).
  const bookmarkIds = useMemo(() => bookmarkPartIds(bookmarks), [bookmarks]);
  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      if (bookmark.bundleId) {
        setOpenPart(null);
        setOpenBundleId(bookmark.bundleId);
        return;
      }
      setOpenBundleId(null);
      openParagraph(bookmark.chunk);
    },
    [openParagraph],
  );
  const closeSheets = useCallback(() => {
    setOpenPart(null);
    setOpenBundleId(null);
  }, []);
  /* AFTER THE LAST MOMENT (founder 2026-09-26): the end card, and a short
     "saved" line each time a sheet finishes on its own. */
  const [endCard, setEndCard] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const {
    saveBehind,
    notice: behindNotice,
    dismiss: dismissBehind,
  } = useSaveBehind();
  const helperSavedRef = useRef(false);
  const finishWalk = useCallback(() => {
    closeSheets();
    setEndCard(true);
  }, [closeSheets]);
  const labelOf = useCallback(
    (bookmark: Bookmark) => slideLabelOf(groups, bookmark.partId),
    [groups],
  );
  const walk = useFeedbackPager({
    bookmarks,
    open: openBookmark,
    closeAll: finishWalk,
    openFeedback,
    ready: deckReady,
    labelOf,
  });
  const closeWalk = useCallback(() => {
    walk.stop();
    closeSheets();
  }, [walk, closeSheets]);

  /* A SHEET THAT FINISHES ON ITS OWN MOVES ON (founder 2026-09-26). The
     helper words saved, or the moment's steps ran out: say so for a moment,
     then open the next moment — or the end card after the last. Closing with
     the ✕ still just closes. */
  const sheetDone = useCallback(() => {
    setToast(
      helperSavedRef.current
        ? CHUNK_SHEET_COPY.toastHelperWordsSaved
        : CHUNK_SHEET_COPY.toastAnswerSaved,
    );
    helperSavedRef.current = false;
    if (walk.pager) walk.pager.onNext();
    else closeSheets();
  }, [walk.pager, closeSheets]);

  /* A SKIPPED MOMENT MOVES ON QUIETLY (24e-1; Phase 6): nothing was saved,
     so no "Answer saved". TAP AND GO (founder 2026-10-05): its bar leaves
     the page at once, settled as the server settles a skip, instead of
     waiting for the next read. */
  const sheetSkipped = useCallback((skipped: DocumentSuggestion | null) => {
    if (skipped) onJudged?.(skipped, "dismissed");
    if (walk.pager) walk.pager.onNext();
    else closeSheets();
  }, [walk.pager, closeSheets, onJudged]);

  /* THE BAR'S ONE CONDITION. A Confident Voice judgement still waits on the
     paragraph, and its helper words are not saved: a paragraph saved with
     helper words carries no bar, its headline is its mark (founder lock
     2026-09-30, B7 and its interpretation Q3; contract 24g). The server's
     window withholds such a paragraph from the next read on; this keeps the
     page true within the same visit too, so a moment practised and then
     saved loses its bar as soon as its headline is on the page. */
  const barWaiting = useCallback(
    (c: DeckChunk) =>
      c.status === "waiting" &&
      !headlines.has(c.part.id) &&
      markWorthShowing(stateOf(c).pending, summaryByParagraph.get(c.part.id)),
    [headlines, stateOf, summaryByParagraph],
  );
  /* REVIEW FEEDBACK (founder 2026-09-26): the bottom button walks the waiting
     moments from the first one in text order — the same walk a tap on a
     bar joins, the same sheets. "Waiting" is exactly the bar's condition, so
     the button can never offer a review the page shows no mark for. */
  const firstWaiting = useMemo(
    () => firstWaitingBookmark(bookmarks, barWaiting),
    [bookmarks, barWaiting],
  );
  const coachStep = useCoachStep({
    arcId,
    message: coachMessage,
    ready: deckReady,
    next: () => {
      if (firstWaiting >= 0) walk.openAt(0);
    },
  });
  /* THE FEEDBACK WALK (build plan D-FW-14), behind its one switch
     (feedbackWalkOn). Off, it reads nothing and draws nothing, and every
     path below runs exactly as before. On, "Review feedback" and a tap on a
     paragraph with an open moment open the walk; helper words picked in it
     are saved through `setRootPhrase` and the lock, behind the screen, as
     the paragraph sheet saves them. */
  const pendingOf = useCallback((c: DeckChunk) => stateOf(c).pending, [stateOf]);
  const answeredOf = useCallback((c: DeckChunk) => stateOf(c).decided, [stateOf]);
  const helperWordsOf = useCallback((partId: string) => headlines.get(partId) ?? null, [headlines]);
  const partLabel = useCallback((partId: string) => slideLabelOf(groups, partId), [groups]);
  const feedbackWalk = useDeckFeedbackWalk({
    chunks,
    groups,
    waiting: barWaiting,
    pendingOf,
    slideLabel: partLabel,
    coachMessage,
    coachSeen: coachStep.seen,
    firstTake: takeCount === 1,
    takeSessionId,
    setRootPhrase,
    onAccept,
    onKeepMine,
    lockPart: onLockPart,
    saveBehind,
    onJudged,
    onEnd: finishWalk,
    answeredOf,
    helperWordsOf,
    finished: walkFinished(deckReady, firstWaiting, coachStep.unseen),
  });
  /* AN UNSEEN COACH WORD IS WAITING TOO (founder 2026-10-05, N48.3 Q11 A):
     "Review feedback" stays for it after every moment is answered, and opens
     on Step 0 (J1: only on the tap; nothing opens by itself). */
  const coachWordWaiting = coachStep.unseen;
  useEffect(() => {
    onReviewWaiting?.(deckReady && (firstWaiting >= 0 || coachWordWaiting));
  }, [deckReady, firstWaiting, coachWordWaiting, onReviewWaiting]);
  const reviewSeenRef = useRef(reviewRequest);
  useEffect(() => {
    if (reviewRequest === reviewSeenRef.current) return;
    reviewSeenRef.current = reviewRequest;
    // The Feedback walk, when its switch is on and it has a screen to show.
    if (feedbackWalk.review()) return;
    // Step 0 first when the coach left a message; its Continue opens the walk.
    if (coachStep.show()) return;
    // TOP TO BOTTOM (founder lock 2026-09-30, B8): the walk visits the
    // open feedbacks and the saved paragraphs in text order, from the first
    // screen, whenever a judgement still waits somewhere in the text.
    if (firstWaiting >= 0) walk.openAt(0);
  }, [reviewRequest, firstWaiting, walk, coachStep, feedbackWalk]);
  /* THE FINISHED WALK, PLAYED AGAIN (founder 2026-10-08, Q-IT643b A): the
     link under "Record Take N" is offered only once nothing waits and the
     walk has a screen to play; its tap plays it with the answers as given. */
  useWalkReplayRequest(feedbackWalk, replayRequest, onReplayReady);

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
      // Text still cut off at the bottom of a screen counts as too long.
      const tuned = allowForHidden(next, hiddenBelow(innerRefs.current), hiddenRef.current);
      hiddenRef.current = tuned.allowance;
      setFit((prev) => (fitChangedMeaningfully(prev, tuned.fit) ? tuned.fit : prev));
    };
    remeasure();
    window.addEventListener("resize", remeasure);
    return () => window.removeEventListener("resize", remeasure);
  }, [deckReady, screens, headlines]);

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


  const titleFor = (slideIndex: number | null): string | null =>
    slideIndex === null ? null : (slideTitles?.[slideIndex] ?? null);

  async function copyDeck() {
    // The whole deck: kicker/title + paragraphs, slides separated by a rule
    // (Lovable §4's copy tool).
    const textOut = groups
      .map((g) => {
        const head = [copyLabelFor(g.slideIndex), titleFor(g.slideIndex)]
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
              // ONE CENTRED READING COLUMN on desktop (founder 2026-09-28),
              // about 65 characters of the deck's type; a phone keeps its
              // full width.
              className="mx-auto flex h-full w-full max-w-[56rem] flex-col gap-4 px-6 py-8 sm:px-10"
            >
              {/* ONE COMPACT ROW (founder 2026-09-26, Ideal Text redesign
                  B): the slide as a small tile, its kicker, and the pencil.
                  The picture used to stand up to 38% of the screen high on
                  every screen of the slide, so the speaker's own words began
                  under it. The tile enlarges on a tap. No slide title heading
                  (founder 2026-09-17): the picture carries the title. The
                  deckless lane uses the same tile (founder 2026-09-19). */}
              {/* SIZED TO THE TEXT (founder 2026-09-28, layout desktop B /
                  phone C): on a phone the slide takes half the width beside
                  its kicker and pencil; on desktop it stands centred above
                  the column with the kicker and pencil under it. */}
              <div className="flex shrink-0 items-center gap-3 md:flex-col md:gap-2">
                {g.slideIndex !== null ? (
                  <DeckSlideThumb
                    presentationRef={presentationRef}
                    pageIndex={g.slideIndex}
                    label={kickerFor(g.slideIndex, slideCount)}
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 items-center gap-3 md:w-full md:flex-none md:justify-center">
                <p className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:flex-none">
                  {kickerFor(g.slideIndex, slideCount)}
                </p>
                {/* A SMALL PENCIL, NOT A WORD (founder 2026-09-26). */}
                <button
                  type="button"
                  onClick={() => setEditingSlideIndex(g.slideIndex)}
                  aria-label="Edit the text"
                  title="Edit the text"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                </div>
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
                // -ml-4 pl-4: room in the margin for the paragraph bars, so
                // the text starts flush with the column (founder 2026-09-28).
                className="scrollbar-none relative -ml-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pl-4"
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
                {/* A FULL EMPTY LINE BETWEEN PARAGRAPHS (founder 2026-09-28:
                    "each paragraph should be separated"). The screen packing
                    reads this gap from the DOM, so it stays honest. */}
                <div className="flex flex-col gap-[1.625rem] md:gap-7">
                  {g.chunks.map((c) => {
                    const st = stateOf(c);
                    /* DOCUMENT STATE (founder 2026-09-26, Ideal Text
                       redesign B, amending contract 24g-1). Every paragraph
                       reads in the full text colour: grey meant two things
                       (a judgement waiting, and words nobody touched) and at
                       55% it read as disabled on the speaker's own speech.
                       A waiting judgement is now the one orange bar in the
                       left margin, and the whole paragraph is its tap target.
                       `unsettled` keeps its one condition — the bar is drawn
                       exactly where the old mark was, so a paragraph can
                       never hold a rewrite or praise without the judgement
                       that carries it (24f) — and a paragraph saved with
                       helper words draws none (B7, Q3; `barWaiting`). */
                    const unsettled = barWaiting(c);
                    return (
                    /* TEXT SIZE (founder 2026-09-30, "D"): 17px on a phone
                       rising to 20px on desktop, down from 21–30px. Only the
                       paragraph text; the helper-words headline keeps its
                       size, so it stands out more. */
                    <p
                      key={`${c.part.id}:${c.sliceIndex ?? 0}`}
                      data-chunk
                      {...paragraphTap(opensFromPage(bookmarkIds, c.part.id, unsettled || opensOwnSheet(c)), () => {
                        // An open moment opens the walk there, when it is on
                        // (Q-B3 A); an answered or saved paragraph its sheet.
                        if (feedbackWalk.tapPart(c.part.id, unsettled)) return;
                        if (!walk.openPart(c.part.id)) openParagraph(c);
                      })}
                      data-settled={unsettled ? undefined : "true"}
                      data-untouched={c.status === "untouched" ? "true" : undefined}
                      className="relative text-[clamp(1.0625rem,0.98rem+0.34vw,1.25rem)] leading-[1.65] text-foreground"
                    >
                      {/* DISPLAY TEXT, which is the whole paragraph unless it
                          was too tall for one screen and got split across
                          several. Only the words on THIS screen are drawn;
                          `c.part.text` — what every control acts on — is
                          untouched. */}
                      {/* HELPER WORDS ARE ORANGE IN THE HEADLINE ONLY
                          (founder 2026-09-26): inside the running text they
                          read in the paragraph's own colour. */}
                      <ParagraphHeadline
                        text={headlineFor(headlines, c.part.id, c.sliceIndex)}
                        onOpen={() => openHelperWords(c)}
                      />
                      <RichText
                        text={c.displayText ?? c.part.text}
                        accent={false}
                        tint={helperWordRanges(
                          c.displayText ?? c.part.text,
                          headlines.get(c.part.id),
                        )}
                        tintClass="italic"
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
                          if (feedbackWalk.tapPart(c.part.id, true)) return;
                          // Joins the walk at this bookmark (Q29 A).
                          if (!walk.openPart(c.part.id)) openParagraph(c);
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
                    ? `Go to ${copyLabelFor(rs.slideIndex)}, screen ${
                        scr.screenOfSlide + 1
                      } of ${scr.screensInSlide}`
                    : `Go to ${copyLabelFor(rs.slideIndex)}`;
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
        <OpenChunkSheet
          key={openSeq}
          state={openState}
          arcId={arcId}
          takeSessionId={takeSessionId}
          headline={headlineOfChunk(headlines, openChunk.part.id)}
          slideLabel={slideLabelOf(groups, openChunk.part.id)}
          onUseHelperWords={async (span) => {
            // Q24 B / Q27 B: the new words are saved and locked. Tap and go
            // (founder 2026-09-28): both writes run together, behind the
            // sheet, which closes now. The paragraph is untouched here, so
            // neither write depends on the other (see emphasiseChosen).
            const chunk = openChunk;
            saveBehind(
              () => helperWordsBehind(setRootPhrase, onLockPart, chunk, span),
              CHUNK_SHEET_COPY.failWordsBehind,
            );
            helperSavedRef.current = true;
            return true;
          }}
          onAccept={onAccept}
          onClose={closeWalk}
          onDone={sheetDone}
          onSkip={sheetSkipped}
          onDocumentChanged={onConfidentMomentChanged}
          pager={walk.pager}
          feedbackPending={feedbackPending}
          practiseHost={{
            onLockIn: (text) => onLockPart(openChunk, text),
            onHelperWordsSaved: () => {
              helperSavedRef.current = true;
            },
          }}
          startPicking={openWords}
          firstTake={takeCount === 1}
          // ‹ back to an answered moment reopens its judgement (QA1 A).
          reopenJudgement={walk.cameBack}
          helperWordsHost={{
            // Words from an earlier Take (B4, D5): the Slide takes them and
            // the lock follows, behind the sheet; the headline stands in.
            onUseFromTake: async (phrase, takeIndex) => {
              if (!onSetHelperWordsFromTake) return false;
              const chunk = openChunk;
              expectHeadline(chunk.part.id, phrase);
              saveBehind(
                () => helperWordsFromTakeBehind(
                  onSetHelperWordsFromTake, onLockPart, chunk, phrase, takeIndex),
                CHUNK_SHEET_COPY.failWordsBehind,
              );
              helperSavedRef.current = true;
              return true;
            },
            // Delete (D4): the words and the lock go, behind the sheet; the
            // headline leaves the page at once.
            onDelete: async () => {
              const chunk = openChunk;
              dropHeadline(chunk.part.id);
              setDeletedHere((prev) => new Set(prev).add(chunk.part.id));
              saveBehind(
                () => deleteHelperWordsBehind(setRootPhrase, onUnlockPart, chunk),
                CHUNK_SHEET_COPY.failWordsBehind,
              );
              return true;
            },
          }}
          renderSheet={(practiseAgain, onAnswered, reopen) => (
        <DeckChunkModal
          key={practiseAgain ? "again" : "judge"}
          practiseAgain={practiseAgain}
          onAnswered={onAnswered}
          reopen={reopen}
          state={openState}
          onAccept={onAccept}
          onUndoAccept={onUndoAccept}
          onKeepMine={onKeepMine}
          onJudged={onJudged}
          onLockIn={async (text: string): Promise<LockResult> => {
            const result = await onLockPart(openChunk, text);
            if (result.outcome === "ok") {
              helperSavedRef.current = true;
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
          onSetRootPhrase={async (phrase) => {
            // Set BEFORE the write: on tap and go the sheet finishes while
            // this is still in flight, and the "saved" line reads it then.
            helperSavedRef.current = Boolean(phrase);
            const ok = await setRootPhrase(openChunk, phrase);
            if (!ok) helperSavedRef.current = false;
            return ok;
          }}
          saveBehind={saveBehind}
          onDocumentChanged={onConfidentMomentChanged}
          onClose={closeWalk}
          onDone={sheetDone}
          pager={walk.pager}
          onApplyStyle={onApplyStyle}
          arcId={arcId}
          firstTake={takeCount === 1}
        />
          )}
        />
      ) : null}
      {deckReady && editingSlideIndex !== undefined ? (
        <SlideEditor
          key={editingSlideIndex ?? "unlinked"}
          where={copyLabelFor(editingSlideIndex)}
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
          key={openBundle.bundleId}
          bundle={openBundle}
          pager={walk.pager}
          history={bundleHistory(openBundle.paragraphId, chunks, arcId, headlines)}
          documentSnapshotId={confidentMoments.projection!.documentSnapshotId}
          ownerEdit={confidentMomentOwnerEdit}
          onChanged={() => {
            confidentMoments.refresh();
            onConfidentMomentChanged?.();
          }}
          onClose={closeWalk}
        />
      ) : null}
      {feedbackWalk.element}
      <CoachStepLayer
        step={coachStep}
        message={coachMessage}
        stepsAhead={coachStepsAhead(bookmarks, firstWaiting, stateOf)}
      />
      <WalkEndLayer
        endCard={endCard}
        renderNextStep={renderNextStep}
        onCloseEndCard={() => setEndCard(false)}
        toast={toast}
        onToastGone={() => setToast(null)}
        notice={behindNotice}
        onNoticeGone={dismissBehind}
      />
    </div>
  );
}

/** The slide editor, drawn like Ideal Text Final Screens' editor frame
 *  (build plan D-IT-4): a full-screen sheet with a top bar ("Edit the text"
 *  over "Slide n", and ✕), the slide's paragraphs as cards, the signed note,
 *  a black Save pill with a grey Cancel link under it. No slide picture: the
 *  page behind already shows it. The write is unchanged — only the
 *  paragraphs whose words changed go to `onSave`, the host's compare-and-set
 *  edit. Exported for tests. */
export function SlideEditor({
  where,
  chunks,
  onCancel,
  onSave,
}: {
  /** Where the text sits: "Slide 2", or "Your talk" with no deck. */
  where: string;
  chunks: readonly DeckChunk[];
  onCancel: () => void;
  onSave: (edits: Array<{ chunk: DeckChunk; text: string }>) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState(() => chunks.map((chunk) => chunk.part.text));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = () => {
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
  };
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-label="Edit the text"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-[17px] font-semibold text-foreground">Edit the text</h2>
          <p className="text-[11px] leading-snug text-muted-foreground">{where}</p>
        </div>
        <OverlayCloseButton onClick={onCancel} />
      </div>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-5">
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
              frameClass="min-h-32 border border-border bg-background focus-within:border-foreground"
            />
          ))}
          {/* WHAT AN EDIT IS FOR (founder 2026-09-26, J11): the next Take
              rewrites the paragraph from what is said (clause 8/9), and this
              version stays in its history (clause 16). Said here, before
              Save, so an edit never feels lost afterwards. */}
          <p className="text-[13px] leading-snug text-muted-foreground">
            {CHUNK_SHEET_COPY.editorNextTakeNote}
          </p>
          {failed ? (
            <p data-testid="slide-editor-failed" className="text-[13px] text-destructive">
              Couldn&apos;t save this slide. Your edits are still here.
            </p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 border-t border-border pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-0.5 px-5">
          <button
            type="button"
            disabled={saving || drafts.some((draft) => !draft.trim())}
            onClick={save}
            className="flex min-h-[54px] w-full items-center justify-center rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex min-h-[48px] w-full items-center justify-center text-[16px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** The kicker above a slide's text on the Ideal Text page: "Slide 2 of 6"
 *  (shown in capitals by CSS), as Ideal Text Final Screens draws it; "Slide
 *  2" while the deck's length is unknown; "Your talk" for a text with no
 *  deck. Exported for tests. */
export function kickerFor(slideIndex: number | null, slideCount: number | null): string {
  if (slideIndex === null) return "Your talk";
  if (!slideCount || slideCount <= slideIndex) return `Slide ${slideIndex + 1}`;
  return `Slide ${slideIndex + 1} of ${slideCount}`;
}

/** "Slide 2", as the copied text and the rail's "Go to" labels name a slide
 *  (unchanged by the kicker's "of m"). */
function copyLabelFor(slideIndex: number | null): string {
  return slideIndex === null ? "Your talk" : `Slide ${slideIndex + 1}`;
}

/** "Slide 2" for the walk's header, from the slide the paragraph sits on. */
function slideLabelOf(
  groups: readonly { slideIndex: number | null; chunks: readonly DeckChunk[] }[],
  partId: string,
): string | null {
  const group = groups.find((g) => g.chunks.some((c) => c.part.id === partId));
  if (!group) return null;
  return group.slideIndex === null ? "Your talk" : `Slide ${group.slideIndex + 1}`;
}

/** The first bookmark, in text order, whose paragraph still waits. -1 when
 *  nothing waits. Pure, so the deck gains no branch. */
/** How many feedback screens follow step 0: the first waiting moment's
 *  pending items. Screens only (AC-9); 0 when nothing waits. Pure, so the
 *  deck gains no branch (complexity ratchet). */
function coachStepsAhead(
  bookmarks: readonly Bookmark[],
  firstWaiting: number,
  stateOf: (c: DeckChunk) => { pending: readonly unknown[] },
): number {
  const bookmark = firstWaiting >= 0 ? bookmarks[firstWaiting] : undefined;
  return bookmark ? stateOf(bookmark.chunk).pending.length : 0;
}

function firstWaitingBookmark(
  bookmarks: readonly Bookmark[],
  waiting: (chunk: DeckChunk) => boolean,
): number {
  return bookmarks.findIndex((b) => waiting(b.chunk));
}

/* THE GREY BAR IS GONE (founder lock 2026-09-30, B7). A paragraph with
   nothing open draws no bar: plain text, full width. Only green and orange
   bars exist, and they are the mark's. It is no longer a tap target either:
   "a paragraph that is not bookmarked should not open on tap" (founder
   2026-10-06, N56.5, amending B7's "still opens its own sheet on tap";
   `opensFromPage`). */
/** THE PARAGRAPH'S HEADLINE (founder 2026-09-26, superseding Q20 A's one
 *  line per Slide): its own helper words, bold orange, directly above it —
 *  like a newspaper headline over the article that repeats its words. Inside
 *  the running text the same words are italic, in the paragraph's own colour
 *  and font; the headline is the only orange. A block span inside the
 *  paragraph element, so the tap target and the screen packing still see one
 *  paragraph. Its own component so the deck gains no branch. */
function ParagraphHeadline({
  text,
  onOpen,
}: {
  text: string | null;
  /** A tap on the headline opens the helper words overlay (founder lock
   *  2026-09-30, B4), not the paragraph's own sheet under it. */
  onOpen: () => void;
}) {
  if (!text) return null;
  return (
    <span
      data-paragraph-headline
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      className="mb-1 block cursor-pointer text-[clamp(1.45rem,1.1rem+1.3vw,2.15rem)] font-bold not-italic leading-snug text-primary"
    >
      {text}
    </span>
  );
}

/** A settled paragraph that was answered or locked opens its own sheet when
 *  tapped (founder 2026-09-25, Q26 B), if it is a bookmark (founder
 *  2026-10-06, N56.5; `opensFromPage`). A button in behaviour; the words
 *  stay ordinary text. One that does not open gets nothing: no role, no
 *  focus, no pointer. Pure, so the deck gains no branch. */
function paragraphTap(
  opens: boolean,
  open: () => void,
): Record<string, unknown> {
  if (!opens) return {};
  return {
    role: "button",
    tabIndex: 0,
    "data-opens-sheet": "true",
    onClick: open,
    onKeyDown: (event: { key: string; preventDefault: () => void }) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    },
    style: { cursor: "pointer" },
  };
}

/** The open paragraph's own helper words, from the same map the page draws. */
function headlineOfChunk(
  headlines: Map<string, string>,
  partId: string,
): string | null {
  return headlines.get(partId) ?? null;
}

/** What the coaching sheet shows under the coach's work once the moment is
 *  answered (founder 2026-09-25): the paragraph's own history. */
function bundleHistory(
  paragraphId: string,
  chunks: readonly DeckChunk[],
  arcId: string | null,
  headlines: Map<string, string>,
): { arcId: string | null; partId: string; text: string; headline: string | null } | null {
  const chunk = chunks.find((c) => c.part.id === paragraphId);
  if (!chunk) return null;
  return {
    arcId,
    partId: chunk.part.id,
    text: chunk.part.text,
    headline: headlineOfChunk(headlines, chunk.part.id),
  };
}
