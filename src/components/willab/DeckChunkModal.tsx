"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Lock, Sparkles, Undo2, X } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import MarkedEditor from "@/components/willab/MarkedEditor";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  buildRatingBody,
  saveConfidenceAgreement,
  type TernaryValue,
} from "@/services/api/stateRatings";
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
import type {
  DecisionHistoryEntry,
  DocumentSuggestion,
} from "@/services/api/idealText";

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

interface DeckChunkModalProps {
  chunk: DeckChunk;
  /** The pending proposal to review, when the chunk is waiting. Null routes
   *  straight to the EDITOR face. */
  suggestion: DocumentSuggestion | null;
  /** Decide approve. Resolves true when saved; the host refetches and the
   *  updated chunk text flows back down. */
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  /** Brief, real Undo after an accepted clarity rewrite. */
  onUndoAccept?: (s: DocumentSuggestion) => Promise<boolean>;
  /** Decide disregard ("Keep mine"). Resolves true when saved. */
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  /** Commit the draft (when changed) and lock the part. */
  onLockIn: (text: string) => Promise<LockOutcome>;
  /** UNDO the lock (founder 2026-08-15) — the inverse of onLockIn, and the
   *  only thing "Discard" means on a locked chunk. Optional: a host that
   *  cannot unlock simply shows no button there, which is the pre-08-15
   *  behaviour rather than a Discard that does nothing. */
  onUnlockPart?: (() => Promise<LockOutcome>) | null;
  onClose: () => void;
  /** THE STYLE LANE (slice 2) — a pending post-lock bold for this chunk,
   *  surfaced ONLY here. Null = none. */
  styleSuggestion?: DocumentSuggestion | null;
  /** Apply the style proposal (rides outside the ≤3 budget). */
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
  suggestion,
  onAccept,
  onUndoAccept,
  onKeepMine,
  onLockIn,
  onUnlockPart = null,
  onClose,
  styleSuggestion = null,
  onApplyStyle,
  history = null,
  coachSnippetId = null,
  coachReviewStatus = null,
  arcId = null,
}: DeckChunkModalProps) {
  // Accept morphs the face; everything else derives from the chunk.
  // KEYED ON THE WORK, NOT THE STATE. `chunk.status` folds "approved, not
  // locked" into "locked", so reading it here meant a chunk with a real
  // pending proposal could still open the editor. The proposal itself is the
  // only thing that decides whether there is a review to run — and on a
  // re-opened locked chunk (R1 gen-4) that is exactly the case that matters.
  const [face, setFace] = useState<"review" | "editor">(
    chunk.pendingIds.length > 0 && suggestion ? "review" : "editor",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedRewrite, setAcceptedRewrite] =
    useState<DocumentSuggestion | null>(null);
  const [rewriteCollisionConfirmed, setRewriteCollisionConfirmed] =
    useState(false);

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
      : chunk.part.locked
        ? "Locked chunk"
        : "Edit this chunk";

  async function accept() {
    if (!suggestion || busy) return;
    if (rewriteOverlapsFlagship && !rewriteCollisionConfirmed) {
      setRewriteCollisionConfirmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onAccept(suggestion);
    setBusy(false);
    if (!ok) {
      setError("Couldn't save that decision. Try again.");
      return;
    }
    // The student is never dropped back to the page mid-decision: the modal
    // re-renders as the editor over the freshly accepted words.
    dirtyRef.current = false;
    if (
      suggestion.kind === "replace" &&
      suggestion.source !== "new_take" &&
      suggestion.source !== "prior_take"
    ) {
      setAcceptedRewrite(suggestion);
    }
    setFace("editor");
  }

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

  async function keepMine() {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const ok = await onKeepMine(suggestion);
    setBusy(false);
    if (!ok) {
      setError("Couldn't save that decision. Try again.");
      return;
    }
    // Keep mine: the words are untouched and the proposal moves into
    // history. The modal closes (Lovable §3.1); the lock stays one tap away
    // for a student who wants to commit their own wording.
    onClose();
  }

  async function lockIn() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const outcome = await onLockIn(draft.trim());
    setBusy(false);
    if (outcome === "ok") {
      onClose();
      return;
    }
    setError(
      outcome === "blocked"
        ? "Decide every suggestion on this chunk first."
        : "Couldn't lock this in. Try again.",
    );
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
      parseRichSpans(chunk.part.text).some((span) => {
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
  const [agreeValue, setAgreeValue] = useState<TernaryValue | null>(null);
  const [agreeSaving, setAgreeSaving] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
  const [agreeSaved, setAgreeSaved] = useState(false);

  async function sendAgreement(
    value: TernaryValue | null,
    unrateable: boolean
  ) {
    const snippetId = suggestion?.snippetId;
    if (!snippetId || agreeSaving) return;
    const body = buildRatingBody(value, unrateable);
    // null means the pair could not express a real answer — a body that would
    // fabricate a label nobody gave must be impossible to send, not merely
    // rejected later.
    if (!body) return;
    setAgreeSaving(true);
    setAgreeError(null);
    const r = await saveConfidenceAgreement(snippetId, body);
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

  // ONE BUTTON, AND THE LOCK DECIDES WHICH (founder 2026-08-15: "it should be
  // either lock or discard — lock on the unlocked, discard on the locked").
  //
  // Discard used to sit beside Lock in on EVERY editor face, wired to
  // `onClose`. On an untouched chunk that discards nothing — it is a second
  // close button wearing the word "Discard", which is why it read as a no-op
  // (founder 2026-08-12: "if I click discard nothing happens"). The 08-12 fix
  // hid BOTH buttons on a settled locked chunk; the real problem was that the
  // pair was never two choices in the first place.
  //
  // So the row is now a TOGGLE of the thing the icon shows:
  //   unlocked            → Lock in
  //   locked + untouched  → Discard, which UNLOCKS (the inverse, not a close)
  //   locked + edited     → Lock in, so the edit can be saved
  //
  // The last line is load-bearing: a locked chunk stays editable by design,
  // and an edit the student cannot lock in is an edit they cannot save. It is
  // compared against the served text rather than the dirty ref on purpose —
  // typing a change and typing it back leaves nothing to save either, and a
  // ref would not re-render anyway.
  //
  // Discarding an EDIT needs no button: closing the modal already drops it,
  // on a locked and an unlocked chunk alike.
  //
  // Not gated on `chunk.status`: a re-opened locked chunk (pending work beats
  // the lock) is already on the REVIEW face, which owns its own buttons.
  const lockedAndSettled =
    chunk.part.locked === true && draft === chunk.part.text;
  const showUnlock = lockedAndSettled && !!onUnlockPart;

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
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        Does this sound confident to you?
                      </p>
                      <div className="flex gap-2">
                        {(["yes", "no"] as const).map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={agreeSaving}
                            onClick={() => {
                              setAgreeValue(value);
                              void sendAgreement(value, false);
                            }}
                            className={`rounded-full border px-5 py-2 text-[14px] font-medium transition-colors disabled:opacity-50 ${
                              agreeValue === value
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground hover:bg-muted"
                            }`}
                          >
                            {value === "yes" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                      {agreeSaving ? (
                        <p className="text-[12px] text-muted-foreground">Saving…</p>
                      ) : null}
                      {agreeError ? (
                        <p className="text-[12px] text-destructive">{agreeError}</p>
                      ) : null}
                    </div>
                  ) : agreeValue === "no" ? (
                    <p className="text-[15px] font-medium leading-relaxed text-foreground">
                      {CONFIDENT_VOICE_NO}
                    </p>
                  ) : (
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
                    </>
                  )}
                </div>
              ) : isPraise ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-[15px] font-medium leading-relaxed text-foreground">
                    {PRAISE_LEAD}
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

              {/* THE STYLE LANE (slice 2): the post-lock emphasis proposal,
                  surfaced ONLY here — the page never re-marks locked text.
                  Rides OUTSIDE the ≤3 budget. */}
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

        {face !== "review" && lockedAndSettled && !onUnlockPart ? (
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
                onClick={() =>
                  void (agreeValue === "yes" ? accept() : keepMine())
                }
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
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void accept()}
                  className="flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  Use as flagship
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void keepMine()}
                  className="flex items-center justify-center rounded-full border border-foreground/20 px-5 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Not now
                </button>
              </>
            ) : face === "review" && suggestion ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void accept()}
                  className="flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  {suggestion.kind === "replace"
                    ? rewriteOverlapsFlagship && rewriteCollisionConfirmed
                      ? "Confirm clearer version"
                      : "Use clearer version"
                    : "Accept"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void keepMine()}
                  className="flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-5 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Keep mine
                </button>
              </>
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
              // EVERYTHING ELSE → the only move is to lock it in.
              <button
                type="button"
                disabled={busy || draft.trim().length === 0}
                onClick={() => void lockIn()}
                className="col-span-2 flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden />
                )}
                Lock in
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
