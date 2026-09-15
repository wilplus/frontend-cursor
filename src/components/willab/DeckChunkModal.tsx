"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Lock, Pencil, Sparkles, ThumbsUp, Undo2 } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import MarkedEditor from "@/components/willab/MarkedEditor";
import { RichText } from "./RichText";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import ConfidenceLabelChips from "@/components/willab/ConfidenceLabelChips";
import {
  saveTakeFeedbackResponse,
  type FeedbackResponse,
} from "@/services/api/takeFeedback";
import type { RootPhraseSpan } from "@/services/api/partLock";
/* The explanation copy is gone from this sheet (founder 2026-09-15, §6): the
   Confident Voice block (CONFIDENT_VOICE_WHY / CONFIDENT_VOICE_NO /
   AGREE_THANKS and its cue list), the praise cue list, and the machine's
   whyLine() rationale. PRAISE_LEAD stays — it is the praise itself, not an
   explanation of it. */
import { PRAISE_LEAD } from "@/lib/willab/trackedChangeWhy";
import { emphasizeQuote } from "@/lib/willab/emphasizeQuote";
import { parseRichSpans } from "@/lib/willab/richMarkers";
import {
  type ChunkHistoryLite,
  type ChunkState,
  type CoachMomentLite,
} from "@/lib/willab/deckChunks";
import ConfidentVoicePractice from "@/components/willab/ConfidentVoicePractice";
import Mlc3FirstClientPractice from "@/components/willab/Mlc3FirstClientPractice";
import { mlc3FirstClientPresentationEnabled } from "@/services/api/mlc3FirstClient";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { useVisibleLearningExposure } from "@/hooks/useVisibleLearningExposure";
import RootingPhraseQualificationActions from "@/components/willab/RootingPhraseQualificationActions";
import type { RootingPhraseRoutingState } from "@/lib/willab/rootingPhraseQualification";

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

/* displayKind is GONE (founder 2026-09-15). It existed to render the kind
   eyebrow — "Possible clarity improvement" and its siblings — and §6 removes
   that eyebrow from every screen. Its last consumer was this file's own
   re-export, so keeping the module would have left a taxonomy nothing could
   reach: dead code that still reads as product vocabulary. Deleted with its
   test rather than left to look load-bearing. */

export type LockOutcome = "ok" | "blocked" | "failed";
export type LockResult = {
  outcome: LockOutcome;
  rootPhraseProposal: RootPhraseSpan | null;
};

// One definition of "is this the Confident Voice lane", beside the ladder that
// orders it first, so the sort and the card's own render can never disagree
// about which item they are looking at.
import {
  buildChunkSteps,
  isConfidentVoiceFeedback,
  stepProgress,
  stepTitle,
  type ChunkStep,
} from "@/lib/willab/chunkSteps";
import {
  nextSelection,
  phraseTokens,
  quoteSpan,
  selectionText,
  type PhraseSelection,
} from "@/lib/willab/phraseTokens";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";

interface DeckChunkModalProps {
  /** ONE STATE PER CHUNK (audit Q-C5): identity and spans, the lock, the
   *  decision kicker, the pending inventory (the backend caps the complete
   *  Take inventory at three — an empty inventory routes straight to the
   *  EDITOR face; since 2026-09-15 the inventory is a QUEUE, presented one
   *  item at a time, not a list shown up front), the style-lane proposal and
   *  the coach's join, computed once in lib/willab/deckChunks.ts. */
  state: ChunkState<DocumentSuggestion, ChunkHistoryLite, CoachMomentLite>;
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
  /** Apply a legacy style proposal (`state.style`); new roots use
   *  onSetRootPhrase. */
  onApplyStyle?: (s: DocumentSuggestion) => Promise<boolean>;
  /** Kept on the contract, unused by the sheet since 2026-09-15: the coach
   *  note card it fed is gone from every screen (§6). Hosts still pass it and
   *  the coach's own surfaces still render that card. */
  arcId?: string | null;
  /** Disabled RPQ-V1 enrichment. It never changes the existing V3 inventory. */
  rootingPhraseRoutingState?: RootingPhraseRoutingState | null;
}

export default function DeckChunkModal({
  state,
  onAccept,
  onUndoAccept,
  onKeepMine,
  onLockIn,
  onKeepEvolving,
  onSetRootPhrase,
  onUnlockPart = null,
  onClose,
  onApplyStyle,
  arcId = null,
  rootingPhraseRoutingState = null,
}: DeckChunkModalProps) {
  // The chunk's state, named as the faces below have always read it. The
  // proposal to open on is the first of the pending inventory; an empty
  // inventory routes to the EDITOR face.
  const { chunk, pending: pendingSuggestions, style: styleSuggestion, coach } = state;
  const coachReviewStatus = coach.reviewStatus;
  // Freeze the inventory for this modal opening. A refetch removes a decided
  // payload row, but it must not rewrite the student's memory of which items
  // were present when review began. Resolved rows are marked locally; no new
  // identity can enter this list.
  const [feedbackInventory] = useState<readonly DocumentSuggestion[]>(() => {
    const source = pendingSuggestions;
    const seen = new Set<string>();
    return source.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 3);
  });
  /* THE LADDER (founder 2026-09-15). One ordered list built when the sheet
   * opens, walked one screen at a time, ending at the lock. It replaces the
   * three faces ("review" | "editor" | "root") and the in-place iteration of
   * the inventory — see lib/willab/chunkSteps.ts for why the order is enforced
   * rather than inherited from the payload.
   *
   * Frozen with the inventory: a refetch must not lengthen or reorder the
   * ladder under a speaker who is halfway down it. */
  const [steps] = useState<ChunkStep[]>(() =>
    buildChunkSteps({
      inventory: feedbackInventory,
      // Nothing to emphasise on an empty paragraph, and nothing to choose on
      // one already locked and settled — that sheet is a single Discard.
      //
      // A LOCKED paragraph WITH a style offer still gets the step, and that is
      // the point of the style lane rather than an exception to it: "open
      // takes rewrites; locked takes emphasis only". Gating on the lock alone
      // would delete the post-lock emphasis offer outright.
      canEmphasise:
        chunk.part.text.trim().length > 0 &&
        (Boolean(styleSuggestion) || chunk.part.locked !== true),
    }),
  );
  const [stepId, setStepId] = useState<string>(() => steps[0]?.id ?? "lock");
  const step = steps.find((entry) => entry.id === stepId) ?? steps[steps.length - 1];
  const suggestion =
    step && step.kind !== "emphasis" && step.kind !== "lock"
      ? feedbackInventory.find((item) => item.id === step.id) ?? null
      : null;
  useVisibleLearningExposure({
    handles: suggestion?.learningExposures ?? [],
    visibilityKey: suggestion?.id ?? "no-feedback",
    enabled: suggestion !== null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewriteCollisionConfirmed, setRewriteCollisionConfirmed] =
    useState(false);
  /** THE BRIEF, REAL UNDO after an accepted rewrite. The ladder has no editor
   *  face to host it any more, and the handoff never asked for it to go — so
   *  it moves onto the lock card, where the accepted words now sit. Not in the
   *  footer: that would be a second decision on a screen whose whole point is
   *  having one. */
  const [acceptedRewrite, setAcceptedRewrite] =
    useState<DocumentSuggestion | null>(null);
  const hadFeedback = feedbackInventory.length > 0;
  /* Tap-to-select for the rooting phrase. `emphasisTap` is the mode; the
   * selection is a run of token indices, never typed text — see
   * lib/willab/phraseTokens.ts on why the offsets must be raw-draft ones. */
  const [emphasisTap, setEmphasisTap] = useState(false);
  const [phraseRun, setPhraseRun] = useState<PhraseSelection | null>(null);
  /** The words the speaker chose to emphasise, as a reader sees them. Resolved
   *  against the locked draft at lock time — see lockIn. `null` is Skip, and
   *  Skip is a real answer, not a deferral. */
  const [promotedQuote, setPromotedQuote] = useState<string | null>(null);
  /** Set by Discard. The served chunk still says locked until the host
   *  refetches, so without this the sheet would keep offering Discard to a
   *  paragraph it has just unlocked. */
  const [unlocked, setUnlocked] = useState(false);
  /** Move to the next screen. The lock step is always last, so this always
   *  lands somewhere and there is no "no more items" branch to get wrong. */
  function advanceStep(): void {
    const at = steps.findIndex((entry) => entry.id === stepId);
    const next = steps[at + 1];
    if (next) setStepId(next.id);
    setRewriteCollisionConfirmed(false);
    setError(null);
    // The next item gets a CLEAN instrument, and this is an L3 fix, not a
    // cosmetic one. The Confident Voice answer state is per ITEM, but it lived
    // per MODAL: without this reset a second confident-voice item on the same
    // chunk opened already answered — thank-you copy over a clip nobody rated
    // — and because Done posts `agreeValue ?? "not_sure"`, tapping it wrote
    // the PREVIOUS clip's owner answer as this clip's response. One
    // recording's routing signal recorded against another recording is exactly
    // what the provenance wall forbids, and the speaker was never even asked.
    // Ordinary under the V3 policy, which returns one Confident Voice item per
    // 75-word block rather than one per Take.
    setAgreeValue(null);
    setAgreeSaved(false);
    setAgreeError(null);
  }

  // The always-editable draft. Re-synced from the served text whenever the
  // part's words change UNDER the modal (an accept reassembles the document)
  // — but never over something the student has typed.
  const [draft, setDraft] = useState(chunk.part.text);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) setDraft(chunk.part.text);
  }, [chunk.part.text]);


  async function recordFeedbackResponse(response: FeedbackResponse): Promise<boolean> {
    if (!suggestion?.takeSessionId || !suggestion.feedbackFamily) return false;
    const result = await saveTakeFeedbackResponse({
      takeSessionId: suggestion.takeSessionId,
      feedbackId: suggestion.id,
      feedbackFamily: suggestion.feedbackFamily,
      response,
      candidateId: suggestion.candidateId,
      feedbackMembershipId: suggestion.feedbackMembershipId,
      feedbackExposureId: suggestion.feedbackExposureId,
    });
    if (!result.ok) {
      setError(result.error ?? COPY.failResponse);
      return false;
    }
    return true;
  }

  /* CONTINUE STILL WRITES (founder 2026-09-15, BE migration 0333).
   *
   * The praise screen stopped asking Useful / Not useful / Not sure — a black
   * CTA on a question about your own praise makes disagreeing feel like
   * refusing. But the RATING IS WHAT MARKED THE ITEM DECIDED: drop the write
   * with the rating and praise is re-offered every time the paragraph opens,
   * forever. So Continue writes an acknowledgement instead of a verdict, and
   * `acknowledged` deliberately produces no canonical praise-helpfulness
   * label — "I read this" is not a point on that scale. */
  async function acknowledgePraise() {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const ok = await recordFeedbackResponse("acknowledged");
    setBusy(false);
    if (!ok) return;
    advanceStep();
  }


  async function undoAcceptedRewrite() {
    if (!acceptedRewrite || !onUndoAccept || busy) return;
    setBusy(true);
    setError(null);
    const ok = await onUndoAccept(acceptedRewrite);
    setBusy(false);
    if (!ok) {
      setError(COPY.failApply);
      return;
    }
    setAcceptedRewrite(null);
    onClose();
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
        setError(COPY.failApply);
      }
      return;
    }
    setAcceptedRewrite(suggestion.kind === "replace" ? suggestion : null);
    advanceStep();
  }

  async function editImprovementMyself() {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const ok = await recordFeedbackResponse("edit_myself");
    setBusy(false);
    if (!ok) return;
    advanceStep();
  }

  async function keepImprovementWording() {
    if (!suggestion || busy) return;
    setBusy(true);
    setError(null);
    const responseSaved = await recordFeedbackResponse("keep_wording");
    const kept = responseSaved ? await onKeepMine(suggestion) : false;
    setBusy(false);
    if (!responseSaved || !kept) {
      if (responseSaved && !kept) setError(COPY.failKeep);
      return;
    }
    advanceStep();
  }

  async function lockIn() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await onLockIn(draft.trim());
    if (result.outcome !== "ok") {
      setBusy(false);
      setError(
        result.outcome === "blocked" ? COPY.failLockBlocked : COPY.failLock,
      );
      return;
    }
    /* EMPHASIS + LOCK PROMOTES THE PHRASE BY ITSELF (founder 2026-09-15).
     *
     * There is no rooting-phrase screen after a lock any more. The speaker
     * already said which words matter, on the emphasis step, and asking again
     * is asking twice. So the words they chose are resolved against the text
     * that was actually locked and stored directly.
     *
     * Resolved here rather than carried as an offset on purpose: an accepted
     * emphasis rewraps the words in `**`, which moves every raw index after
     * it. The readable text is stable across that; an offset is not.
     *
     * A quote that no longer resolves — edited away, or now ambiguous — locks
     * with no anchor rather than guessing at one. Skip does the same, and
     * means it: nothing asks again later.
     *
     * The confidence-only gate is unchanged. A paragraph whose only feedback
     * was the confidence question gets an orange anchor ONLY if the speaker
     * said yes; any other answer locks the wording and ends there. */
    const confidenceOnly =
      feedbackInventory.length > 0 &&
      feedbackInventory.every(isConfidentVoiceFeedback);
    const anchor =
      promotedQuote && !(confidenceOnly && agreeValue !== "yes")
        ? quoteSpan(draft, promotedQuote)
        : null;
    if (anchor) await onSetRootPhrase(anchor);
    setBusy(false);
    onClose();
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
    setError(COPY.failEvolve);
  }

  /* THE EMPHASIS STEP'S THREE MOVES.
   *
   * Emphasise (proposed)  — take the offered words: apply the bold, and carry
   *                         them to the lock as the orange anchor.
   * Emphasise (tap)       — take your own: no bold, just the anchor. Bold is
   *                         the style lane's; the orange is the recording
   *                         anchor, which is why the tapped words preview in
   *                         --primary rather than in a selection colour.
   * Skip                  — lock with no anchor at all.
   */
  async function emphasiseProposed() {
    if (!styleSuggestion || busy) return;
    setPromotedQuote(styleSuggestion.quote || null);
    if (onApplyStyle) await applyStyle();
    advanceStep();
  }

  function emphasiseChosen() {
    setPromotedQuote(selectionText(draft, phraseTokens(draft), phraseRun));
    advanceStep();
  }

  function skipEmphasis() {
    setPromotedQuote(null);
    advanceStep();
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

  async function applyStyle() {
    if (!styleSuggestion || !onApplyStyle || busy) return;
    const before = draft;
    const next = emphasizeQuote(draft, styleSuggestion.quote);
    if (next !== draft) {
      dirtyRef.current = true;
      setDraft(next);            // ← the point: visible on this frame
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
      }
      setError(COPY.failEmphasis);
    }
  }


  async function unlock() {
    if (busy || !onUnlockPart) return;
    setBusy(true);
    setError(null);
    const outcome = await onUnlockPart();
    setBusy(false);
    if (outcome === "ok") {
      // DISCARD LANDS ON THE EDITOR, NOT ON THE PAGE (founder 2026-09-15,
      // §5). It used to call onClose(), so undoing a lock also dismissed the
      // sheet — the speaker asked to edit and was put back where they started,
      // with the paragraph now unlocked and nothing on screen saying so. The
      // lock step is the editor, so staying here IS the editor.
      setUnlocked(true);
      setStepId("lock");
      return;
    }
    setError(COPY.failUnlock);
  }

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
    suggestion !== null && isConfidentVoiceFeedback(suggestion);
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
      candidateId: suggestion.candidateId,
      feedbackMembershipId: suggestion.feedbackMembershipId,
      feedbackExposureId: suggestion.feedbackExposureId,
    });
    setAgreeSaving(false);
    if (r.ok) {
      setAgreeSaved(true);
      /* NO SEPARATE "DONE" STEP (founder 2026-09-15: "drop the Done step").
       *
       * Answering WAS the decision; the screen that followed held a thank-you
       * and a button whose only job was to admit it. The answer is already
       * saved by the call above, so the tap bought nothing and cost a screen.
       * Now the answer advances straight to the next feedback, or closes the
       * review when it was the last one.
       *
       * The ONE case that still stops here is a waiting practice exercise —
       * that offer lives on this post-answer screen and is the only thing on
       * it worth a tap. Auto-advancing past it would delete the micro-practice
       * journey rather than tidy it, which is not what "drop the Done step"
       * asked for. Keep this guard until practice has somewhere else to live.
       *
       * No second write: `saveTakeFeedbackResponse` above already recorded
       * this answer, and the retired Done button called it AGAIN through
       * resolveObservedFeedback with the same id and value. */
      const practiceWaiting = Boolean(
        suggestion.practiceExercise &&
          suggestion.snippetId &&
          suggestion.evidence,
      );
      if (!practiceWaiting) {
        advanceStep();
      }
      return;
    }
    // Roll the chip back rather than leaving it lit over a row the server
    // never took — the same rule the style apply follows.
      setAgreeValue(null);
      setAgreeError(r.error ?? COPY.failResponse);
  }

  // Paragraph versioning boundary: after this Take's feedback is resolved,
  // the student explicitly chooses Lock for next Take or Keep evolving.
  // Reopening a settled paragraph that had no feedback keeps the established
  // inverse action (unlock). A paragraph that did have feedback must pass the
  // explicit commit boundary again even if it arrived already locked.
  const lockedAndSettled =
    chunk.part.locked === true && draft === chunk.part.text;
  const showUnlock =
    lockedAndSettled && !hadFeedback && !!onUnlockPart && !unlocked;

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

  /* ---- what each screen shows and what its one pill does ----------------- */
  const progress = stepProgress(steps, step?.id ?? null);
  const tokens = step?.kind === "emphasis" ? phraseTokens(draft) : [];
  const emphasisPreview =
    step?.kind === "emphasis" && styleSuggestion
      ? emphasizeQuote(draft, styleSuggestion.quote)
      : draft;
  const reopenedClean = !hadFeedback && chunk.part.locked !== true;
  const title = stepTitle(step?.kind ?? "lock", reopenedClean);

  type FooterLink = { label: string; onClick: () => void };
  const footer: {
    pill: string | null;
    icon: React.ReactNode;
    pillDisabled?: boolean;
    onPill?: () => void;
    links: FooterLink[];
  } = (() => {
    const none = { pill: null, icon: null, links: [] as FooterLink[] };
    if (!step) return none;
    if (step.kind === "feedback") {
      // Pre-answer there is no footer AT ALL: listen, then answer. A secondary
      // action here would offer a way past the one question the screen exists
      // to ask. Post-answer the sheet has already advanced unless a practice
      // offer is waiting, and then Done is the way on.
      if (!agreeSaved) return none;
      return {
        pill: COPY.pillDone,
        icon: <Check className="h-4 w-4" aria-hidden />,
        onPill: () => advanceStep(),
        links: [],
      };
    }
    if (step.kind === "praise") {
      return {
        pill: COPY.pillContinue,
        icon: null,
        onPill: () => void acknowledgePraise(),
        links: [],
      };
    }
    if (step.kind === "suggestion") {
      return {
        pill: COPY.pillApply,
        icon: <Check className="h-4 w-4" aria-hidden />,
        onPill: () => void applyImprovement(),
        links: [
          { label: COPY.linkKeepWording, onClick: () => void keepImprovementWording() },
        ],
      };
    }
    if (step.kind === "emphasis") {
      const tapping = emphasisTap || !styleSuggestion;
      return {
        pill: COPY.pillEmphasise,
        icon: <Sparkles className="h-4 w-4" aria-hidden />,
        pillDisabled: tapping && phraseRun === null,
        onPill: tapping
          ? () => emphasiseChosen()
          : () => void emphasiseProposed(),
        links: tapping
          ? [{ label: COPY.linkSkip, onClick: () => skipEmphasis() }]
          : [
              {
                label: COPY.linkChooseWords,
                onClick: () => setEmphasisTap(true),
              },
              { label: COPY.linkSkip, onClick: () => skipEmphasis() },
            ],
      };
    }
    // THE LOCK STEP. A settled locked paragraph reopened with nothing pending
    // has exactly one move, and it is the inverse of the lock.
    if (showUnlock) {
      return {
        pill: COPY.pillDiscard,
        icon: <Undo2 className="h-4 w-4" aria-hidden />,
        onPill: () => void unlock(),
        links: [],
      };
    }
    return {
      pill: COPY.pillLock,
      icon: <Lock className="h-4 w-4" aria-hidden />,
      pillDisabled: draft.trim().length === 0,
      onPill: () => void lockIn(),
      links: [
        { label: COPY.linkKeepEvolving, onClick: () => void keepEvolving() },
      ],
    };
  })();

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
            {/* NO EYEBROW. The kind label is gone from every screen: it
                announced the machine's read above words the speaker had not
                yet judged. The title alone names the decision. */}
            <h2 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
              {title}
            </h2>
          </button>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
        </div>


        {/* THE STEP BAR. One segment per SCREEN — filled for done, dark for
            current, light for upcoming.

            AC-9: it may only ever count screens. It must never encode how many
            problems were found or how confident the speaker sounded; a
            four-segment bar on one paragraph beside a three-segment bar on
            another would say exactly that, in a column, without a word. The
            lock step is always present, so the total is "decisions in front of
            you", never a verdict. Hidden on a one-step sheet, where a single
            full-width segment would be decoration. */}
        {steps.length > 1 ? (
          <div
            className="flex shrink-0 gap-1.5 px-5 pb-1 pt-1"
            aria-hidden
          >
            {steps.map((entry, index) => (
              <span
                key={entry.id}
                className={`h-1 flex-1 rounded-full ${
                  index < progress.current
                    ? "bg-foreground/25"
                    : index === progress.current
                      ? "bg-foreground"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>
        ) : null}

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

          {/* ---- FEEDBACK · the one qualitative question ------------------ */}
          {step.kind === "feedback" && suggestion ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
              {suggestion.snippetAudioRef ? (
                <MediaPlayer
                  src={suggestion.snippetAudioRef}
                  startOffsetMs={suggestion.startOffsetMs ?? 0}
                  durationMs={suggestion.durationMs ?? 0}
                />
              ) : null}
              {mlc3FirstClientPresentationEnabled &&
              suggestion.firstClientService ? (
                <Mlc3FirstClientPractice suggestion={suggestion} />
              ) : !agreeSaved ? (
                <ConfidenceLabelChips
                  question={COPY.confidenceQuestion}
                  value={agreeValue}
                  disabled={agreeSaving}
                  saving={agreeSaving}
                  error={agreeError}
                  ownerWording
                  onPick={(value) => void sendAgreement(value)}
                />
              ) : suggestion.practiceExercise &&
                suggestion.snippetId &&
                suggestion.evidence ? (
                /* The only thing left on this screen after an answer. The
                   thank-you copy is gone (founder: drop the Done step), but a
                   waiting practice offer still has to be reachable. */
                <ConfidentVoicePractice
                  snippetId={suggestion.snippetId}
                  offer={suggestion.practiceExercise}
                  evidence={suggestion.evidence}
                  originalUserAnswer={agreeValue === "no" ? "no" : "yes"}
                />
              ) : null}
            </div>
          ) : null}

          {/* ---- GOOD JOB · read, not rated ------------------------------- */}
          {step.kind === "praise" && suggestion ? (
            <>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                  {COPY.cardWhatYouSaid}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                  {suggestion.quote || chunk.part.text}
                </p>
              </div>
              <div className="relative rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
                <span className="absolute right-4 top-4 text-pending" aria-hidden>
                  <ThumbsUp className="h-4 w-4" />
                </span>
                <p className="pr-8 text-[15px] leading-relaxed text-foreground">
                  {suggestion.tentative
                    ? "This may be one of the strongest formulations in this Take."
                    : PRAISE_LEAD}
                </p>
              </div>
            </>
          ) : null}

          {/* ---- SUGGESTION · what you said, and the clearer version ------ */}
          {step.kind === "suggestion" && suggestion ? (
            <>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                  {COPY.cardWhatYouSaid}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                  {suggestion.quote || chunk.part.text}
                </p>
              </div>
              <div className="rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                    {COPY.cardClearerVersion}
                  </p>
                  {/* THE PENCIL IS "EDIT MYSELF" — same handler, same
                      edit_myself response, sitting on the words it edits
                      instead of competing with the accept at the bottom. */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void editImprovementMyself()}
                    aria-label="Edit myself"
                    className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-pending transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                  {suggestion.kind === "bold"
                    ? suggestion.quote || chunk.part.text
                    : (suggestion.proposedText ?? "")}
                </p>
              </div>
            </>
          ) : null}

          {/* ---- EMPHASIS · the only place the orange is decided ---------- */}
          {step.kind === "emphasis" ? (
            emphasisTap || !styleSuggestion ? (
              /* TAP TO SELECT. Reached by "Choose different words", or opened
                 into directly when nothing was proposed. The tapped words
                 preview in --primary because that is how a rooting phrase
                 renders while recording — a preview, not a selection colour. */
              <div className="rounded-2xl border border-border px-3 py-4">
                <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                  {COPY.cardTapWords}
                </p>
                <div className="mt-2 flex flex-wrap gap-0.5">
                  {tokens.map((token, index) => {
                    const picked =
                      phraseRun !== null &&
                      index >= phraseRun.from &&
                      index <= phraseRun.to;
                    return (
                      <button
                        key={`${token.start}-${token.text}`}
                        type="button"
                        aria-pressed={picked}
                        onClick={() =>
                          setPhraseRun(nextSelection(phraseRun, index))
                        }
                        className={`inline-flex min-h-[44px] items-center rounded-lg px-1.5 text-[15px] leading-tight transition-colors ${
                          picked
                            ? "bg-primary/10 text-primary"
                            : "text-foreground"
                        }`}
                      >
                        {token.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* PROPOSED. The paragraph with the emphasis already applied, so
                 the speaker confirms something they can see rather than
                 agreeing to a description of it. */
              <div className="rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                    {COPY.cardWithEmphasis}
                  </p>
                  <span className="-mt-0.5 shrink-0 text-pending" aria-hidden>
                    <Sparkles className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                  <RichText text={emphasisPreview} />
                </p>
              </div>
            )
          ) : null}

          {/* ---- LOCK · the same last question on every path -------------- */}
          {step.kind === "lock" ? (
            <div className="relative rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
              <span className="absolute right-4 top-4 text-pending" aria-hidden>
                <Lock className="h-4 w-4" />
              </span>
              {acceptedRewrite && onUndoAccept ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void undoAcceptedRewrite()}
                  className="mb-2 flex items-center gap-1.5 text-[13px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden />
                  Undo rewrite
                </button>
              ) : null}
              {chunk.part.locked === true && !hadFeedback ? (
                <p className="pr-8 text-[15px] leading-relaxed text-foreground">
                  <RichText text={draft} />
                </p>
              ) : (
                /* Still the editor. The design draws this step as a card, but
                   editing has to stay reachable somewhere and a separate
                   screen for it would put two decisions back on one path. */
                <MarkedEditor
                  value={draft}
                  onChange={(next) => {
                    dirtyRef.current = true;
                    setDraft(next);
                  }}
                  toolbar={false}
                  /* 16px IS A FUNCTIONAL FLOOR ON iOS: mobile Safari
                     force-zooms the viewport for a focusable editable under
                     16px, so tapping in zoomed the page and the deck behind
                     came back at the wrong scale. */
                  textSizeClass="text-[16px] leading-relaxed"
                  frameClass="border-0 bg-transparent pr-6"
                />
              )}
            </div>
          ) : null}

          {/* THE COACH NOTE CARD IS GONE (founder 2026-09-15, §6) — from
              every screen, not just this one. The coach REVIEW STATUS pill
              above stays: it says whether a human has looked, which is a
              different thing from putting their prose on a decision screen.
              DeckCoachFeedback itself is untouched and still mounted by the
              coach's own surfaces. */}

          <RootingPhraseQualificationActions
            state={rootingPhraseRoutingState}
            busy={busy}
          />

          {/* ONE MESSAGE STYLE. A plain bordered box, grey, normal weight, no
              tint — the one exception being a failure, which keeps red text in
              the same box because a missed save costs the speaker their
              edit. */}
          {error ? (
            <p
              role="alert"
              className="rounded-2xl border border-border px-4 py-3 text-[13px] leading-snug text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        {/* ---- ONE DECISION PER FOOTER ---------------------------------- */}
        {/* One black pill, and zero or more stacked grey links beneath it.
            Never two buttons side by side; every pill is the verb of its own
            screen, so the screens cannot read as interchangeable. */}
        <div className="flex shrink-0 flex-col gap-0.5 px-5 pb-5 pt-1">
          {footer.pill ? (
            <button
              type="button"
              disabled={footer.pillDisabled || busy}
              onClick={footer.onPill}
              className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : footer.icon }
              {footer.pill}
            </button>
          ) : null}
          {footer.links.map((link) => (
            <button
              key={link.label}
              type="button"
              disabled={busy}
              onClick={link.onClick}
              className="flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
