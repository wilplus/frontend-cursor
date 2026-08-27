"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Lock, Sparkles, Undo2 } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import MarkedEditor from "@/components/willab/MarkedEditor";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import ConfidenceLabelChips from "@/components/willab/ConfidenceLabelChips";
import {
  saveTakeFeedbackResponse,
  type FeedbackResponse,
} from "@/services/api/takeFeedback";
import type { RootPhraseSpan } from "@/services/api/partLock";
import {
  AGREE_THANKS,
  CONFIDENT_VOICE_NO,
  CONFIDENT_VOICE_WHY,
  PRAISE_CUE_LEAD,
  PRAISE_LEAD,
  praiseLines,
  whyLine,
} from "@/lib/willab/trackedChangeWhy";
import { emphasizeQuote } from "@/lib/willab/emphasizeQuote";
import { parseRichSpans } from "@/lib/willab/richMarkers";
import { type DeckChunk } from "@/lib/willab/deckChunks";
import DeckCoachFeedback from "@/components/willab/DeckCoachFeedback";
import ConfidentVoicePractice from "@/components/willab/ConfidentVoicePractice";
import type {
  DecisionHistoryEntry,
  DocumentSuggestion,
} from "@/services/api/idealText";
import { useVisibleLearningExposure } from "@/hooks/useVisibleLearningExposure";

/* -------------------------------------------------------------------------- */
/*  DeckChunkModal — the two faces behind a chunk's lock (founder 2026-08-11,  */
/*  Lovable spec §3). One modal, because Accept MORPHS REVIEW into EDITOR in   */
/*  place: the student is never dropped back to the page mid-decision.         */
/*                                                                            */
/*    REVIEW (waiting + a pending proposal): what you said → suggested →       */
/*      rationale → Accept / Keep mine.                                       */
/*    EDITOR (accepted / locked / clean): the always-editable, marker-aware    */
/*      field → Lock in / Discard.                                            */
/*                                                                            */
/*  The HOST owns every network call — this component only renders state and   */
/*  awaits the callbacks, so the three decide lanes, the user-edit PUT and     */
/*  the part-lock PUT stay exactly where they already live and the deck        */
/*  cannot fork the contract. Copy is the founder's spec vocabulary            */
/*  verbatim; the rationale line is the signed-off whyLine() copy — the        */
/*  modal never renders model free text (LIVE LOOP). A coach_revision may     */
/*  render its explicitly coach-authored note.                                 */
/* -------------------------------------------------------------------------- */

// displayKind lives in its own pure .ts module so the founder's display
// taxonomy is unit-testable (vitest cannot transform .tsx imports here);
// re-exported so existing importers keep their path.
import { displayKind } from "./displayKind";
export { displayKind };

export type LockOutcome = "ok" | "blocked" | "failed";
export type LockResult = {
  outcome: LockOutcome;
  rootPhraseProposal: RootPhraseSpan | null;
};

interface DeckChunkModalProps {
  chunk: DeckChunk;
  /** The pending proposal to review, when the chunk is waiting. Null routes
   *  straight to the EDITOR face. */
  suggestion: DocumentSuggestion | null;
  /** The immutable pending inventory for this chunk. It is shown up front so
   *  resolving item one never makes item two appear as a surprise. The
   *  backend caps the complete Take inventory at three. */
  pendingSuggestions?: readonly DocumentSuggestion[];
  /** Decide approve. Resolves true when saved; the host refetches and the
   *  updated chunk text flows back down. */
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  /** Brief, real Undo after an accepted clarity rewrite. */
  onUndoAccept?: (s: DocumentSuggestion) => Promise<boolean>;
  /** Decide disregard ("Keep mine"). Resolves true when saved. */
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  /** Commit the draft (when changed) and lock the part. */
  onLockIn: (text: string) => Promise<LockResult>;
  /** Save the draft but explicitly leave this paragraph replaceable. */
  onKeepEvolving: (text: string) => Promise<LockOutcome>;
  /** Post-lock orange metadata; null is an explicit Skip. */
  onSetRootPhrase: (phrase: RootPhraseSpan | null) => Promise<boolean>;
  /** UNDO the lock (founder 2026-08-15) — the inverse of onLockIn, and the
   *  only thing "Discard" means on a locked chunk. Optional: a host that
   *  cannot unlock simply shows no button there, which is the pre-08-15
   *  behaviour rather than a Discard that does nothing. */
  onUnlockPart?: (() => Promise<LockOutcome>) | null;
  onClose: () => void;
  /** THE STYLE LANE (slice 2) — a pending post-lock bold for this chunk,
   *  surfaced ONLY here. Null = none. */
  styleSuggestion?: DocumentSuggestion | null;
  /** Apply a legacy style proposal; new roots use onSetRootPhrase. */
  onApplyStyle?: (s: DocumentSuggestion) => Promise<boolean>;
  /** PROPOSAL HISTORY (slice 2) — the arc's decided proposals; the modal
   *  lists the ones whose words belong to this chunk. */
  history?: readonly DecisionHistoryEntry[] | null;
  /** THE COACH'S OWN FEEDBACK (slice 4) — the snippet the coach left a note
   *  or a video on for THIS chunk's words, or null. Shown on both faces,
   *  locked chunks included (founder: "even on a locked screen you can
   *  still see that feedback"). */
  coachSnippetId?: string | null;
  coachReviewStatus?:
    | "pending_coach_review"
    | "coach_reviewed"
    | "not_confirmed"
    | null;
  /** The arc the coach's message is fetched from, on demand. */
  arcId?: string | null;
}

export default function DeckChunkModal({
  chunk,
  suggestion: initialSuggestion,
  pendingSuggestions = [],
  onAccept,
  onUndoAccept,
  onKeepMine,
  onLockIn,
  onKeepEvolving,
  onSetRootPhrase,
  onUnlockPart = null,
  onClose,
  styleSuggestion = null,
  onApplyStyle,
  history = null,
  coachSnippetId = null,
  coachReviewStatus = null,
  arcId = null,
}: DeckChunkModalProps) {
  // Freeze the inventory for this modal opening. A refetch removes a decided
  // payload row, but it must not rewrite the student's memory of which items
  // were present when review began. Resolved rows are marked locally; no new
  // identity can enter this list.
  const [feedbackInventory] = useState<readonly DocumentSuggestion[]>(() => {
    const source = pendingSuggestions.length > 0
      ? pendingSuggestions
      : initialSuggestion
        ? [initialSuggestion]
        : [];
    const seen = new Set<string>();
    return source.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 3);
  });
  const [resolvedFeedbackIds, setResolvedFeedbackIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(
    initialSuggestion?.id ?? feedbackInventory[0]?.id ?? null,
  );
  const unresolvedFeedback = feedbackInventory.filter(
    (item) => !resolvedFeedbackIds.has(item.id),
  );
  const suggestion =
    unresolvedFeedback.find((item) => item.id === activeFeedbackId) ??
    unresolvedFeedback[0] ??
    null;
  useVisibleLearningExposure({
    handles: suggestion?.learningExposures ?? [],
    visibilityKey: suggestion?.id ?? "no-feedback",
    enabled: suggestion !== null,
  });
  // Accept morphs the face; everything else derives from the chunk.
  // KEYED ON THE WORK, NOT THE STATE. `chunk.status` folds "approved, not
  // locked" into "locked", so reading it here meant a chunk with a real
  // pending proposal could still open the editor. The proposal itself is the
  // only thing that decides whether there is a review to run — and on a
  // re-opened locked chunk (R1 gen-4) that is exactly the case that matters.
  const [face, setFace] = useState<"review" | "editor" | "root">(
    chunk.pendingIds.length > 0 && suggestion ? "review" : "editor",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedRewrite, setAcceptedRewrite] =
    useState<DocumentSuggestion | null>(null);
  const [rewriteCollisionConfirmed, setRewriteCollisionConfirmed] =
    useState(false);
  const hadFeedback = feedbackInventory.length > 0;
  const [rootProposal, setRootProposal] = useState<RootPhraseSpan | null>(null);
  const [customRoot, setCustomRoot] = useState("");
  const [choosingRoot, setChoosingRoot] = useState(false);

  function advanceAfterDecision(decidedId: string): boolean {
    const remaining = feedbackInventory.filter(
      (item) => item.id !== decidedId && !resolvedFeedbackIds.has(item.id),
    );
    setResolvedFeedbackIds((previous) => new Set(previous).add(decidedId));
    if (remaining.length === 0) {
      return false;
    }
    setActiveFeedbackId(remaining[0].id);
    setRewriteCollisionConfirmed(false);
    setError(null);
    return true;
  }

  // The always-editable draft. Re-synced from the served text whenever the
  // part's words change UNDER the modal (an accept reassembles the document)
  // — but never over something the student has typed.
  const [draft, setDraft] = useState(chunk.part.text);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) setDraft(chunk.part.text);
  }, [chunk.part.text]);

  // The chunk's maturity — lock-in cycles survived (slice 2). A process
  // count in the kicker, exactly the founder's spec vocabulary.
  const iteration = chunk.part.iteration ?? 0;
  const iterTail =
    iteration > 0
      ? ` · ${iteration} iteration${iteration === 1 ? "" : "s"}`
      : "";
  const kicker =
    face === "review" && suggestion
      ? `${displayKind(suggestion)}${iterTail}`
      : face === "root"
        ? `Locked for the next Take${iterTail}`
      : // THE PAGE no longer distinguishes accepted from clean — since
        // 2026-08-15 only a server lock turns the mark green, because the
        // merged state flashed green on its way to grey on every accept. In
        // HERE the difference is still real and still worth saying, because
        // this is where the lock action lives.
        //
        // KEYED ON THE APPROVED RIDER, not on `chunk.status`. The status can
        // no longer say "accepted" — that is the whole point of the change —
        // so reading it here would have silently retired this kicker and left
        // an accepted chunk claiming "No feedback pending". Same lesson as
        // the face selector above: read the work, not the page's summary of it.
        chunk.part.locked
        ? `Locked in${iterTail}`
        : chunk.approvedIds.length > 0
          ? "Accepted · not locked in yet"
          : "No feedback pending";
  const title =
    face === "review"
      ? "Suggested change"
      : face === "root"
        ? "Choose a rooting phrase"
      : chunk.part.locked
        ? "Locked chunk"
        : "Edit this chunk";

  async function undoAcceptedRewrite() {
    if (!acceptedRewrite || !onUndoAccept || busy) return;
    setBusy(true);
    setError(null);
    const ok = await onUndoAccept(acceptedRewrite);
    setBusy(false);
    if (!ok) {
      setError("Couldn't restore your original words. Try again.");
      return;
    }
    setAcceptedRewrite(null);
    onClose();
  }

  async function recordFeedbackResponse(response: FeedbackResponse): Promise<boolean> {
    if (!suggestion?.takeSessionId || !suggestion.feedbackFamily) return false;
    const result = await saveTakeFeedbackResponse({
      takeSessionId: suggestion.takeSessionId,
      feedbackId: suggestion.id,
      feedbackFamily: suggestion.feedbackFamily,
      response,
      snippetId: suggestion.snippetId,
    });
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that response. Try again.");
      return false;
    }
    return true;
  }

  async function resolveObservedFeedback(response: FeedbackResponse) {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const ok = await recordFeedbackResponse(response);
    setBusy(false);
    if (!ok) return;
    if (advanceAfterDecision(suggestion.id)) return;
    setFace("editor");
  }

  async function applyImprovement() {
    if (!suggestion || busy) return;
    if (rewriteOverlapsFlagship && !rewriteCollisionConfirmed) {
      setRewriteCollisionConfirmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    const responseSaved = await recordFeedbackResponse("apply_suggestion");
    const applied = responseSaved ? await onAccept(suggestion) : false;
    setBusy(false);
    if (!responseSaved || !applied) {
      if (responseSaved && !applied) {
        setError("Your choice is safe, but the text update needs another try.");
      }
      return;
    }
    if (advanceAfterDecision(suggestion.id)) return;
    setAcceptedRewrite(suggestion.kind === "replace" ? suggestion : null);
    setFace("editor");
  }

  async function editImprovementMyself() {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const ok = await recordFeedbackResponse("edit_myself");
    setBusy(false);
    if (!ok) return;
    const decidedId = suggestion.id;
    if (advanceAfterDecision(decidedId)) return;
    setFace("editor");
  }

  async function keepImprovementWording() {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const responseSaved = await recordFeedbackResponse("keep_wording");
    const kept = responseSaved ? await onKeepMine(suggestion) : false;
    setBusy(false);
    if (!responseSaved || !kept) {
      if (responseSaved && !kept) setError("Your choice is safe. Refresh to continue.");
      return;
    }
    if (advanceAfterDecision(suggestion.id)) return;
    setFace("editor");
  }

  async function lockIn() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await onLockIn(draft.trim());
    setBusy(false);
    if (result.outcome === "ok") {
      setRootProposal(result.rootPhraseProposal);
      setFace("root");
      return;
    }
    setError(
      result.outcome === "blocked"
        ? "Decide every suggestion on this chunk first."
        : "Couldn't lock this in. Try again.",
    );
  }

  async function keepEvolving() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const outcome = await onKeepEvolving(draft.trim());
    setBusy(false);
    if (outcome === "ok") {
      onClose();
      return;
    }
    setError("Couldn't keep this paragraph evolving. Try again.");
  }

  async function saveRoot(phrase: RootPhraseSpan | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await onSetRootPhrase(phrase);
    setBusy(false);
    if (ok) {
      onClose();
      return;
    }
    setError("Choose exact words from this paragraph and try again.");
  }

  function customRootSpan(): RootPhraseSpan | null {
    const phrase = customRoot.trim();
    if (!phrase) return null;
    const start = draft.indexOf(phrase);
    if (start < 0 || draft.lastIndexOf(phrase) !== start) return null;
    return { text: phrase, start, end: start + phrase.length };
  }

  /* APPLY THE EMPHASIS ON THE SPOT (founder 2026-08-15: "when I clicked to
   * apply styling it didn't apply … it did apply but after I have closed the
   * modal. I want it to happen right the moment you click, and that you can
   * revert it if you want").
   *
   * The button awaited the server and changed NOTHING locally, so the words in
   * front of the student stayed plain until the host refetched and the modal
   * re-rendered from the new served text — which, if they closed it first,
   * looked like the click had done nothing and the state had "reactivated"
   * later. The write was fine. The feedback was missing.
   *
   * So the draft gains the emphasis markers immediately, and the server call
   * rides behind it. On failure the draft goes back to exactly what it was —
   * a local edit is trivially reversible, which is why doing it first is safe
   * here in a way an irreversible action would not be. */
  const [styleUndo, setStyleUndo] = useState<string | null>(null);

  async function applyStyle() {
    if (!styleSuggestion || !onApplyStyle || busy) return;
    const before = draft;
    const next = emphasizeQuote(draft, styleSuggestion.quote);
    if (next !== draft) {
      dirtyRef.current = true;
      setDraft(next);            // ← the point: visible on this frame
      setStyleUndo(before);
    }
    setBusy(true);
    setError(null);
    const ok = await onApplyStyle(styleSuggestion);
    setBusy(false);
    if (!ok) {
      // Put the words back rather than leaving an emphasis the server does
      // not have — the screen must not claim a change that did not land.
      if (next !== draft) {
        setDraft(before);
        setStyleUndo(null);
      }
      setError("Couldn't apply that. Try again.");
    }
  }

  function undoStyle() {
    if (styleUndo === null) return;
    dirtyRef.current = true;
    setDraft(styleUndo);
    setStyleUndo(null);
  }

  async function unlock() {
    if (busy || !onUnlockPart) return;
    setBusy(true);
    setError(null);
    const outcome = await onUnlockPart();
    setBusy(false);
    if (outcome === "ok") {
      onClose();
      return;
    }
    setError("Couldn't unlock this. Try again.");
  }

  const rationale = suggestion
    ? suggestion.source === "coach_revision"
      ? suggestion.coachNote ?? null
      : whyLine(suggestion)
    : null;
  const rewriteOverlapsFlagship = Boolean(
    suggestion?.kind === "replace" &&
      suggestion.quote?.trim() &&
      ([
        ...(chunk.part.rootPhrase
          ? [{ text: chunk.part.rootPhrase, highlight: true }]
          : []),
        ...parseRichSpans(chunk.part.text),
      ]).some((span) => {
        if (!span.highlight || !span.text.trim()) return false;
        const accepted = span.text.trim().toLocaleLowerCase();
        const rewrite = suggestion.quote!.trim().toLocaleLowerCase();
        return rewrite.includes(accepted) || accepted.includes(rewrite);
      })
  );

  /* THE PRAISE LANE (founder 2026-08-15): "if the delivery was impeccable,
   * just give them the feedback in the praise lane and in the justification
   * of the positive feedback give them the playback of that phrase
   * emphasising that it was said really well and explain using the vocal and
   * verbal cues."
   *
   * It is the one suggestion with NOTHING TO DECIDE — no words change, no
   * alternative is offered — so it does not render the what-you-said /
   * suggested pair (there is no "suggested"), and it does not offer Accept /
   * Keep mine, which would ask the student to choose between a compliment and
   * their own writing. One "Got it" settles it through the same lane, so a
   * praise note is not re-offered every time the chunk opens.
   *
   * The recording is the whole reason this reads as evidence rather than
   * flattery: the claim is about how it SOUNDED, and it is the only claim
   * this product makes that the student cannot check by reading. */
  const isPraise =
    suggestion?.feedbackFamily === "great_formulation" ||
    suggestion?.device === "impeccable";
  const praiseCues = isPraise ? praiseLines(suggestion?.cueKeys ?? []) : [];

  /* THE CONFIDENT VOICE CARD (founder 2026-08-15): "when it comes to
   * confident voice do the same but also display the voice game panel and ask
   * them do they agree? … also make the modal in the case of confident voice
   * a full screen modal."
   *
   * Same three parts as praise — it lands, hear it, here is why — and then the
   * instrument, because this card is the one place the product states a read
   * of the speaker's own voice back to them. Asking whether they agree costs
   * one tap in the place they already are, which is the fastest and most
   * natural rating this system can collect.
   *
   * WHAT THE ANSWER IS. Routing to the Voice Album, and only routing. The
   * answer is anchored because the machine's read is already visible, so the
   * backend stores it in a dedicated table that no training, calibration,
   * quorum, evaluation, SFT or DPO reader consumes.
   *
   * FULL SCREEN because it now carries a player, an explanation and a
   * question: the two-detent sheet was sized for a paragraph and a pair of
   * buttons, and a question that arrives half below the fold gets answered by
   * whoever scrolls, which biases which moments reach the album rather than
   * merely creating a layout problem. */
  const isConfidentVoice =
    suggestion?.feedbackFamily === "confident_voice" ||
    suggestion?.source === "confident_voice";
  const [agreeValue, setAgreeValue] = useState<ConfidenceRatingValue | null>(null);
  const [agreeSaving, setAgreeSaving] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
  const [agreeSaved, setAgreeSaved] = useState(false);

  async function sendAgreement(value: ConfidenceRatingValue) {
    const snippetId = suggestion?.snippetId;
    const takeSessionId = suggestion?.takeSessionId;
    if (!suggestion || !snippetId || !takeSessionId || agreeSaving) return;
    setAgreeSaving(true);
    setAgreeError(null);
    setAgreeValue(value);
    const r = await saveTakeFeedbackResponse({
      takeSessionId,
      feedbackId: suggestion.id,
      feedbackFamily: "confident_voice",
      response: value,
      snippetId,
    });
    setAgreeSaving(false);
    if (r.ok) {
      setAgreeSaved(true);
      return;
    }
    // Roll the chip back rather than leaving it lit over a row the server
    // never took — the same rule the style apply follows.
      setAgreeValue(null);
      setAgreeError(r.error ?? "Couldn't save that. Try again.");
  }

  // Paragraph versioning boundary: after this Take's feedback is resolved,
  // the student explicitly chooses Lock for next Take or Keep evolving.
  // Reopening a settled paragraph that had no feedback keeps the established
  // inverse action (unlock). A paragraph that did have feedback must pass the
  // explicit commit boundary again even if it arrived already locked.
  const lockedAndSettled =
    chunk.part.locked === true && draft === chunk.part.text;
  const showUnlock = lockedAndSettled && !hadFeedback && !!onUnlockPart;

  // Pointer Events give touch, pen and mouse one gesture contract. The sheet
  // follows the pointer continuously, then settles to one of two detents.
  // Starting inside the scroll body or on an interactive control is ignored,
  // so dragging the sheet cannot steal scrolling, playback, or editing.
  const [expanded, setExpanded] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleExpanded() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setExpanded((value) => !value);
  }

  function onSheetPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isConfidentVoice) return;
    const target = event.target as HTMLElement;
    const grabSurface = target.closest("[data-sheet-grabber]");
    if (
      target.closest("[data-sheet-scroll]") ||
      (!grabSurface &&
        target.closest("button, a, input, textarea, select, [contenteditable='true']"))
    ) {
      return;
    }
    const height = sheetRef.current?.getBoundingClientRect().height;
    if (!height) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height,
      height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragHeight(height);
  }

  function onSheetPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const desktop = window.matchMedia("(min-width: 640px)").matches;
    const minimum = window.innerHeight * (desktop ? 0.62 : 0.58);
    const maximum = window.innerHeight * (desktop ? 0.94 : 0.97);
    const next = Math.min(
      maximum,
      Math.max(minimum, drag.startHeight + drag.startY - event.clientY)
    );
    drag.height = next;
    drag.moved ||= Math.abs(event.clientY - drag.startY) >= 8;
    setDragHeight(next);
  }

  function finishSheetDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const desktop = window.matchMedia("(min-width: 640px)").matches;
    const minimum = window.innerHeight * (desktop ? 0.62 : 0.58);
    const maximum = window.innerHeight * (desktop ? 0.94 : 0.97);
    setExpanded(drag.height >= (minimum + maximum) / 2);
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setDragHeight(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        ref={sheetRef}
        style={dragHeight === null ? undefined : { height: `${dragHeight}px` }}
        className={`flex w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl ease-out sm:rounded-3xl ${
          dragHeight === null ? "transition-[height] duration-300" : "cursor-grabbing"
        } ${
          expanded || isConfidentVoice
            ? "h-[97dvh] max-h-[97dvh] sm:h-[94vh] sm:max-h-[94vh]"
            : "h-[68dvh] max-h-[68dvh] sm:h-[72vh] sm:max-h-[72vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onSheetPointerDown}
        onPointerMove={onSheetPointerMove}
        onPointerUp={finishSheetDrag}
        onPointerCancel={finishSheetDrag}
      >
        {/* THE GRABBER. A real button, not a decorative bar: the founder
            asked for swipe, and swipe alone would leave the second detent
            unreachable by keyboard, by switch control, and on a desktop
            trackpad — so the drag and the tap/Enter do the same thing. It
            carries the touch handlers because the header below it holds the
            close button, and a drag that starts on that button should close,
            not resize. */}
        <button
          type="button"
          data-sheet-grabber
          aria-label={expanded ? "Collapse" : "Expand"}
          aria-expanded={expanded}
          onClick={toggleExpanded}
          className="flex shrink-0 cursor-grab touch-none items-center justify-center pb-1 pt-3 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <span
            className="h-1 w-9 rounded-full bg-foreground/20"
            aria-hidden
          />
        </button>

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-2">
          <button
            type="button"
            data-sheet-grabber
            onClick={toggleExpanded}
            className="min-w-0 cursor-grab touch-none text-left active:cursor-grabbing"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {kicker}
            </p>
            <h2 className="mt-1 text-[17px] font-semibold text-foreground">
              {title}
            </h2>
          </button>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
        </div>

        <div data-sheet-scroll className="scrollbar-none flex flex-col gap-3 overflow-y-auto px-5 py-3">
          {face === "review" && feedbackInventory.length > 1 ? (
            <div
              className="rounded-2xl border border-border bg-card p-3"
              aria-label="Feedback available in this part of your Take"
            >
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Feedback ready · {feedbackInventory.length}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {feedbackInventory.map((item, index) => {
                  const resolved = resolvedFeedbackIds.has(item.id);
                  const active = suggestion?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={resolved}
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        setActiveFeedbackId(item.id);
                        setRewriteCollisionConfirmed(false);
                        setError(null);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60 ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {resolved ? <Check className="h-3 w-3" aria-hidden /> : null}
                      {index + 1}. {displayKind(item)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {coachReviewStatus ? (
            <p className="w-fit rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary">
              {coachReviewStatus === "pending_coach_review"
                ? "Pending coach review"
                : coachReviewStatus === "coach_reviewed"
                  ? "Coach reviewed"
                  : "Not confirmed"}
            </p>
          ) : null}
          {face === "review" && suggestion ? (
            <>
              {!isConfidentVoice ? (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {isPraise ? "Exact formulation" : "What you said"}
                  </p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
                    {suggestion.quote || chunk.part.text}
                  </p>
                </div>
              ) : null}
              {isPraise || isConfidentVoice ? null : (
                <div className="rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {suggestion.kind === "replace" ? "Clearer version" : "Suggested"}
                  </p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
                    {suggestion.kind === "bold"
                      ? suggestion.quote || chunk.part.text
                      : (suggestion.proposedText ?? "")}
                  </p>
                </div>
              )}
              {isConfidentVoice ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                  {suggestion.snippetAudioRef ? (
                    <MediaPlayer
                      src={suggestion.snippetAudioRef}
                      startOffsetMs={suggestion.startOffsetMs ?? 0}
                      durationMs={suggestion.durationMs ?? 0}
                    />
                  ) : null}
                  {!agreeSaved ? (
                    <ConfidenceLabelChips
                      question="Does this sound confident to you?"
                      value={agreeValue}
                      disabled={agreeSaving}
                      saving={agreeSaving}
                      error={agreeError}
                      ownerWording
                      onPick={(value) => void sendAgreement(value)}
                    />
                  ) : agreeValue === "no" ? (
                    <>
                      <p className="text-[15px] font-medium leading-relaxed text-foreground">
                        {CONFIDENT_VOICE_NO}
                      </p>
                      {suggestion.practiceExercise &&
                      suggestion.snippetId &&
                      suggestion.evidence ? (
                        <ConfidentVoicePractice
                          snippetId={suggestion.snippetId}
                          offer={suggestion.practiceExercise}
                          evidence={suggestion.evidence}
                          originalUserAnswer="no"
                        />
                      ) : null}
                    </>
                  ) : agreeValue === "yes" ? (
                    <>
                      <p className="text-[15px] font-medium leading-relaxed text-foreground">
                        {CONFIDENT_VOICE_WHY}
                      </p>
                      {praiseCues.length > 0 ? (
                        <>
                      <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {PRAISE_CUE_LEAD}
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {praiseCues.map((line) => (
                          <li
                            key={line}
                            className="text-[14px] leading-snug text-foreground"
                          >
                            {line}
                          </li>
                        ))}
                      </ul>
                        </>
                      ) : null}
                      <p className="text-[13px] text-muted-foreground">
                        {AGREE_THANKS}
                      </p>
                      {suggestion.practiceExercise &&
                      suggestion.snippetId &&
                      suggestion.evidence ? (
                        <ConfidentVoicePractice
                          snippetId={suggestion.snippetId}
                          offer={suggestion.practiceExercise}
                          evidence={suggestion.evidence}
                          originalUserAnswer="yes"
                        />
                      ) : null}
                    </>
                  ) : (
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {AGREE_THANKS} This stays a calibration note, not a styling decision.
                    </p>
                  )}
                </div>
              ) : isPraise ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-[15px] font-medium leading-relaxed text-foreground">
                    {suggestion.tentative
                      ? "This may be one of the strongest formulations in this Take."
                      : PRAISE_LEAD}
                  </p>
                  <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                    <p className="text-[15px] font-semibold leading-relaxed text-primary">
                      {suggestion.quote || chunk.part.text}
                    </p>
                  </div>
                  {praiseCues.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {praiseCues.map((line) => (
                        <li key={line} className="text-[14px] leading-snug text-foreground">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {rationale && !isPraise && !isConfidentVoice ? (
                <p className="px-1 text-[13px] leading-snug text-muted-foreground">
                  {rationale}
                </p>
              ) : null}
              {rewriteOverlapsFlagship && rewriteCollisionConfirmed ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-primary/35 bg-primary/[0.06] p-4"
                >
                  <p className="text-[14px] font-semibold text-foreground">
                    This rewrite overlaps an anchor you accepted.
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Applying it removes the outdated orange anchor. The clearer
                    sentence will use a neutral root phrase until you choose a
                    new flagship.
                  </p>
                </div>
              ) : null}
              {coachSnippetId && (!isConfidentVoice || agreeSaved) ? (
                <DeckCoachFeedback arcId={arcId} snippetId={coachSnippetId} />
              ) : null}
            </>
          ) : face === "root" ? (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] leading-relaxed text-foreground">
                This paragraph is now locked: these exact words survive the next
                Take. Do you also want one short phrase to appear in orange while
                you record?
              </p>
              {rootProposal ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Suggested exact phrase
                  </p>
                  <p className="mt-2 text-[17px] font-semibold leading-relaxed text-primary">
                    {rootProposal.text}
                  </p>
                </div>
              ) : (
                <p className="rounded-2xl border border-border bg-muted/40 p-4 text-[14px] leading-relaxed text-muted-foreground">
                  No unambiguous short phrase was found. Choose exact words from
                  the paragraph or skip this step.
                </p>
              )}
              {choosingRoot ? (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <label
                    className="text-[12px] font-medium text-foreground"
                    htmlFor="custom-root-phrase"
                  >
                    Copy exact words from this paragraph
                  </label>
                  <input
                    id="custom-root-phrase"
                    value={customRoot}
                    onChange={(event) => {
                      setCustomRoot(event.target.value);
                      setError(null);
                    }}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[16px] text-foreground outline-none focus:border-primary"
                  />
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    It must occur exactly once. We never guess which repeated
                    words you meant.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {acceptedRewrite && onUndoAccept ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void undoAcceptedRewrite()}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden />
                  Undo rewrite
                </button>
              ) : null}
              {/* THE CHUNK'S WORDS — a marker-AWARE field, never a raw one.
                  This was a plain textarea, which printed the document's
                  marker grammar at the reader: apply an emphasis, reopen the
                  chunk, and the box said "**changed everything**". FE-1 is
                  absolute — no character of that grammar ever reaches a
                  reader — and this modal is the only way into the text now,
                  so the leak sat on the one surface that cannot have it.
                  MarkedEditor renders the SAME styled spans the deck does and
                  serializes back byte-for-byte (a legacy ==x== the student
                  never touched comes back as ==x==), so opening a chunk and
                  closing it cannot rewrite the document — which is L1: their
                  take, verbatim. No toolbar: see the prop's note. */}
              <MarkedEditor
                value={draft}
                onChange={(next) => {
                  dirtyRef.current = true;
                  setDraft(next);
                }}
                toolbar={false}
                /* 16px IS A FUNCTIONAL FLOOR ON iOS, NOT A TYPE CHOICE
                 * (2026-08-15). This was 15px, and mobile Safari force-zooms
                 * the viewport whenever a focusable editable is under 16px —
                 * so tapping into the chunk to edit it zoomed the whole page,
                 * and the deck behind the modal came back at the wrong scale.
                 * MarkedEditor's own default (17px) was already clear of it;
                 * only this override dipped below. Do not take it back under
                 * 16px without also solving the zoom. */
                textSizeClass="text-[16px] leading-relaxed"
                frameClass="border border-pending/40 bg-pending/[0.06] focus:border-pending"
              />

              {/* THE COACH (slice 4) — on the locked face too: a locked
                  chunk has no proposal left, and the coach's message is
                  still about these words. */}
              {coachSnippetId ? (
                <DeckCoachFeedback arcId={arcId} snippetId={coachSnippetId} />
              ) : null}

              {/* Legacy post-lock emphasis remains reversible for records that
                  already contain it. New orange roots use the explicit root
                  choice immediately after Lock for next Take. */}
              {styleSuggestion && onApplyStyle ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Style
                  </p>
                  <p className="text-[14px] leading-relaxed text-foreground">
                    Bolden{" "}
                    <span className="font-semibold">
                      &ldquo;{styleSuggestion.quote}&rdquo;
                    </span>
                  </p>
                  {whyLine(styleSuggestion) ? (
                    <p className="text-[13px] leading-snug text-muted-foreground">
                      {whyLine(styleSuggestion)}
                    </p>
                  ) : null}
                  {styleUndo === null ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void applyStyle()}
                      className="self-start rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      Apply emphasis
                    </button>
                  ) : (
                    /* Revertible, as asked. Offered only while the pre-apply
                       words are still held — after a lock-in or a reopen there
                       is nothing local to go back to, and a button that
                       pretended otherwise would be the "nothing happens" bug
                       in a new coat. */
                    <button
                      type="button"
                      disabled={busy}
                      onClick={undoStyle}
                      className="inline-flex items-center gap-1.5 self-start rounded-full border border-border px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden />
                      Undo emphasis
                    </button>
                  )}
                </div>
              ) : null}

              {/* NO PROPOSALS FROM EARLIER ITERATIONS (founder 2026-08-15:
                  "I am not sure that showing the suggestions from the past
                  iterations is a good idea … so in the modal itself there
                  should be no proposal from earlier iteration at all —
                  effectively delete that").

                  It listed every decided proposal whose words matched this
                  chunk, with a "Use this wording" link that loaded it into the
                  draft. Two things were wrong with it in practice. The entries
                  were routinely IDENTICAL to the text already on screen (a
                  proposal the student accepted IS the current wording), so the
                  section repeated the chunk back at them under a heading that
                  promised alternatives. And the link only rendered when the
                  row carried `proposedText`, so a history of quote-only rows
                  showed text that could not be clicked at all — the founder
                  hit exactly that.

                  The deeper reason it is gone rather than fixed: a settled
                  chunk is settled. Re-offering an old wording inside the SAME
                  iteration invites re-litigating a decision the student
                  already made, which is the opposite of what locking in is
                  for. A better wording arriving from a LATER take is a
                  different thing and belongs on the page as a fresh proposal,
                  not in a history drawer.

                  `history` / `decisionHistory` stay on the props and keep
                  flowing from the host — the data is not the problem and a
                  future surface may want it. Nothing renders it here. */}
            </>
          )}

          {error ? (
            <p className="text-[12px] text-destructive">{error}</p>
          ) : null}
        </div>

        {face === "editor" && lockedAndSettled && !hadFeedback && !onUnlockPart ? (
          // A host that cannot unlock (no callback wired) keeps the 08-12
          // behaviour: a settled locked chunk shows no buttons rather than a
          // Discard that would do nothing — the exact no-op this replaced.
          <div className="shrink-0 pb-5" />
        ) : (
          <div className="grid shrink-0 grid-cols-2 gap-2 px-5 pb-5 pt-2">
            {face === "review" && suggestion && isConfidentVoice && !agreeSaved ? (
              // Step one intentionally has no secondary action: listen, then
              // answer Yes or No. The explanation appears only afterwards.
              <div className="col-span-2" />
            ) : face === "review" && suggestion && isConfidentVoice ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolveObservedFeedback(agreeValue ?? "not_sure")}
                className="col-span-2 flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
                Done
              </button>
            ) : face === "review" && suggestion && isPraise ? (
              <div className="col-span-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resolveObservedFeedback("useful")}
                  className="flex items-center justify-center rounded-full bg-foreground px-3 py-3 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  Useful
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resolveObservedFeedback("not_useful")}
                  className="flex items-center justify-center rounded-full border border-foreground/20 px-3 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Not useful
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resolveObservedFeedback("not_sure")}
                  className="flex items-center justify-center rounded-full border border-foreground/20 px-3 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Not sure
                </button>
              </div>
            ) : face === "review" && suggestion ? (
              <div className="col-span-2 grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void applyImprovement()}
                  className="flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  Apply suggestion
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void editImprovementMyself()}
                    className="flex items-center justify-center rounded-full border border-foreground/20 px-3 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Edit myself
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void keepImprovementWording()}
                    className="flex items-center justify-center rounded-full border border-foreground/20 px-3 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Keep wording
                  </button>
                </div>
              </div>
            ) : face === "root" ? (
              <div className="col-span-2 grid gap-2">
                {choosingRoot ? (
                  <button
                    type="button"
                    disabled={busy || customRootSpan() === null}
                    onClick={() => void saveRoot(customRootSpan())}
                    className="rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                  >
                    Use these exact words
                  </button>
                ) : rootProposal ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveRoot(rootProposal)}
                    className="rounded-full bg-primary px-5 py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Make this phrase orange
                  </button>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setChoosingRoot(true)}
                    className="rounded-full border border-foreground/20 px-3 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Choose different words
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveRoot(null)}
                    className="rounded-full border border-foreground/20 px-3 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Skip orange phrase
                  </button>
                </div>
              </div>
            ) : showUnlock ? (
              // LOCKED AND UNTOUCHED → the only move is to undo the lock.
              <button
                type="button"
                disabled={busy}
                onClick={() => void unlock()}
                className="col-span-2 flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-5 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Undo2 className="h-4 w-4" aria-hidden />
                )}
                Discard
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || draft.trim().length === 0}
                  onClick={() => void lockIn()}
                  className="flex items-center justify-center gap-2 rounded-full bg-foreground px-3 py-3 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Lock className="h-4 w-4" aria-hidden />
                  )}
                  Lock for next Take
                </button>
                <button
                  type="button"
                  disabled={busy || draft.trim().length === 0}
                  onClick={() => void keepEvolving()}
                  className="flex items-center justify-center rounded-full border border-foreground/20 px-3 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Keep evolving
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
