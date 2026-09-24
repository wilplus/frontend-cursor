"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Lock,
  Mic,
  Pencil,
  Sparkles,
  Square,
  Undo2,
} from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import LockPreviewText from "@/components/willab/LockPreviewText";
import MarkedEditor from "@/components/willab/MarkedEditor";
import { RichText } from "./RichText";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import type { RootGateAnswer } from "@/lib/willab/chunkSteps";
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
import { useConfidenceExercise } from "@/components/willab/useConfidenceExercise";
import {
  Mlc3ConfidenceQuestion,
  Mlc3ExerciseStep,
  serviceExerciseSettled,
} from "@/components/willab/Mlc3FirstClientPractice";
import { usePracticeFlow } from "@/components/willab/usePracticeFlow";
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
  confidentFragmentOf,
  locksAsPreview,
  isConfidentVoiceFeedback,
  stepProgress,
  stepTitle,
  type ChunkStep,
  judgedStatus,
  opensRootPhrase,
  closesLock,
} from "@/lib/willab/chunkSteps";
import {
  nextSelection,
  phraseTokens,
  tokensWithinFragment,
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
  /** THE JUDGEMENT, REPORTED THE MOMENT IT IS SAVED (founder 2026-09-21:
   *  "the state of the text didn't change and the bookmark stayed there …
   *  it must be happening on the blink of an eye level"). Accept and Keep
   *  mine already tell the host so it can flip the row's status locally;
   *  the Confident Voice answer never did, so the mark stayed lit until the
   *  next refetch caught up. `decided` is the status the server will serve
   *  for this row from now on: "approved" for a Yes, "dismissed" for every
   *  other answer (24g-1). */
  onJudged?: (s: DocumentSuggestion, decided: "approved" | "dismissed") => void;
  /** Kept on the contract, unused by the sheet since 2026-09-15: the coach
   *  note card it fed is gone from every screen (§6). Hosts still pass it and
   *  the coach's own surfaces still render that card. */
  arcId?: string | null;
  /** Disabled RPQ-V1 enrichment. It never changes the existing V3 inventory. */
  rootingPhraseRoutingState?: RootingPhraseRoutingState | null;
}

/** The footer of the MLC-3 exercise rung. Pure, so the sheet's own function
 *  does not grow a branch for it (complexity ratchet). */
function serviceExerciseFooter(
  settled: boolean,
  advance: () => void,
): {
  pill: string | null;
  icon: React.ReactNode;
  pillDisabled?: boolean;
  onPill?: () => void;
  links: { label: string; onClick: () => void }[];
} {
  return {
    pill: COPY.pillDone,
    icon: <Check className="h-4 w-4" aria-hidden />,
    pillDisabled: !settled,
    onPill: advance,
    links: [{ label: COPY.linkNotNow, onClick: advance }],
  };
}

/** The footer of every feedback screen on a SUPERSEDED Take: read-only, so
 *  the one move is on. Pure, for the complexity ratchet. */
function supersededFooter(advance: () => void): {
  pill: string | null;
  icon: React.ReactNode;
  pillDisabled?: boolean;
  onPill?: () => void;
  links: { label: string; onClick: () => void }[];
} {
  return { pill: COPY.pillContinue, icon: null, onPill: advance, links: [] };
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
  onJudged,
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
  /** THE PARAGRAPH'S JUDGEMENT, which outlives the chip that collected it.
   *
   *  `agreeValue` is per ITEM and advanceStep clears it — deliberately, so a
   *  second confident-voice item on the same chunk opens unanswered (L3). But
   *  the emphasis gate asks a question about the PARAGRAPH, and the answer has
   *  to survive the steps in between. The exercise's final judgement
   *  supersedes step one's when it happens: it is a judgement of the same
   *  delivery, made later and better informed. */
  const [judgement, setJudgement] = useState<RootGateAnswer>(null);

  /** An exercise matched to this exact clip, from the confidence item that
   *  carries it. Read off the frozen inventory rather than the current step,
   *  because the exercise is now its own step and no longer rides inside the
   *  confidence screen. */
  const exerciseItem = useMemo(
    () =>
      feedbackInventory.find(
        (item) =>
          isConfidentVoiceFeedback(item) &&
          item.practiceExercise &&
          item.snippetId &&
          item.evidence,
      ) ?? null,
    [feedbackInventory],
  );

  /** THE SERVED CONFIDENT VOICE ITEM (V3). Its answer goes through the MLC-3
   *  service route rather than the legacy one, and its exercise is the
   *  service's frozen offer rather than the catalogue practice above. The flow
   *  is owned HERE, not by the question screen: answering advances the ladder
   *  and unmounts that screen, and the offer, session and attempts must
   *  survive the move to the exercise rung. */
  const serviceItem = useMemo(
    () =>
      mlc3FirstClientPresentationEnabled
        ? feedbackInventory.find(
            (item) => isConfidentVoiceFeedback(item) && item.firstClientService,
          ) ?? null
        : null,
    [feedbackInventory],
  );
  const service = usePracticeFlow(serviceItem);

  /* NOT frozen, and the difference matters. The inventory above is frozen so a
     REFETCH cannot lengthen the ladder under a speaker halfway down it. This
     list still has to answer to the speaker's OWN answers: emphasis appears
     only once the paragraph has been judged Yes (§4), and that answer arrives
     at step one or step three — after the sheet opened. Recomputing on the
     speaker's own decision is what that freeze was protecting, not what it
     was preventing. */
  const buildSteps = useCallback(
    (
      judgementValue: RootGateAnswer,
      servicePractise: boolean = service.exerciseAllowed,
    ): ChunkStep[] =>
      buildChunkSteps({
        inventory: feedbackInventory,
        canPractise: exerciseItem !== null,
        // The service rung exists only once the server has said the answer
        // may carry an offer — passed in explicitly on the advance that the
        // answer causes, because the flow's own state has not re-rendered yet.
        canPractiseService: exerciseItem === null && servicePractise,
        // Nothing to emphasise on an empty paragraph, and nothing to choose on
        // one already locked and settled — that sheet is a single Discard.
        //
        // THE STYLE-OFFER CLAUSE IS DEAD, AND THE FOUNDER HAS RULED IT SHOULD
        // STAY THAT WAY (2026-09-24). This used to claim that "a LOCKED
        // paragraph WITH a style offer still gets the step, and that is the
        // point of the style lane rather than an exception to it: open takes
        // rewrites; locked takes emphasis only". It never did. A locked
        // paragraph carrying only a style offer has no Confident Voice item to
        // answer, so `judgementValue` stays null, `opensRootPhrase` is false,
        // and the branch is unreachable however the style lane behaves. Shown
        // the case, the founder's ruling was that the comment was wrong rather
        // than the behaviour: a settled paragraph is not where a rooting
        // phrase gets chosen. The condition is kept as written because it is
        // the honest expression of "not on a settled paragraph"; only the
        // claim about what it achieves is gone.
        //
        // AND the paragraph must have been ANSWERED — see `opensRootPhrase`
        // for which answers count (founder 2026-09-22: every one of them
        // except "Audio unclear"). A paragraph nobody judged — one the
        // detector never flagged — still reaches Lock with no orange, which is
        // the intended shape rather than a gap.
        canEmphasise:
          opensRootPhrase(judgementValue) &&
          chunk.part.text.trim().length > 0 &&
          (Boolean(styleSuggestion) || chunk.part.locked !== true),
        // FOUNDER 2026-09-24. No, Not sure and Audio unclear take the Lock
        // step off the end: the ladder finishes on emphasis and the sheet
        // closes. Read from the SAME judgement the emphasis gate reads, one
        // line above, so the two can never disagree about the same answer.
        canLock: !closesLock(judgementValue),
      }),
    [
      feedbackInventory,
      exerciseItem,
      service.exerciseAllowed,
      chunk.part.text,
      chunk.part.locked,
      styleSuggestion,
    ],
  );
  const steps = useMemo(() => buildSteps(judgement), [buildSteps, judgement]);
  const [stepId, setStepId] = useState<string>(
    () => buildSteps(null)[0]?.id ?? "lock",
  );
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
  /** THE SUPERSEDED TAKE (backend #597). The server refused the answer with
   *  `not_member`: this Take's frozen set predates the items on screen and
   *  cannot be repaired, so every feedback screen on it is read-only. Not an
   *  error — the red line invited a retry that could never succeed, which is
   *  the dead end this replaces. The question stays visible (founder: "the
   *  first step should by all means be kept"); the chips go quiet and the
   *  footer becomes the way on. No judgement is recorded, so no orange. */
  const [superseded, setSuperseded] = useState(false);
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
  /** @param withJudgement the answer being given RIGHT NOW, when this advance
   *  is caused by one. React has not re-rendered yet, so `steps` in scope was
   *  built from the PREVIOUS judgement — and on a confidence-only paragraph
   *  that list has no emphasis step in it. Advancing by index through it walks
   *  straight past the screen the answer just created, and the speaker never
   *  gets asked which words to emphasise. Building the list from the new
   *  answer is the difference between "the step appears" and "the step is
   *  skipped forever". */
  function advanceStep(
    withJudgement: RootGateAnswer = judgement,
    withServicePractise: boolean = service.exerciseAllowed,
  ): void {
    const list = buildSteps(withJudgement, withServicePractise);
    const at = list.findIndex((entry) => entry.id === stepId);
    const next = list[at + 1];
    /* THE LADDER CAN NOW END SOMEWHERE THAT IS NOT THE LOCK (founder
       2026-09-24). It used to be true that "the lock step is always last, so
       this always lands somewhere and there is no no-more-items branch to get
       wrong" — on No, Not sure and Audio unclear there is no lock step, so
       this is that branch, and it is the close. Nothing is saved here: the
       rooting phrase was written on the emphasis step itself, which is the
       point of moving it there. */
    if (!next) {
      onClose();
      return;
    }
    setStepId(next.id);
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
  /* advanceStep closes over `steps` and `stepId`, so a callback handed to the
     exercise hook must not capture it once. The ref is re-pointed every render
     and read at call time. */
  const advanceStepRef = useRef(advanceStep);
  advanceStepRef.current = advanceStep;

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
      if (result.reason === "superseded") setSuperseded(true);
      else setError(result.error ?? COPY.failResponse);
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
    /* THE LOCK LOCKS THE TEXT. THE EMPHASIS SAVED THE EMPHASIS.
     *
     * FOUNDER 2026-09-24, and it is a statement about versioning rather than
     * about screens: "lock the whole text chunk with the edits made and saved
     * on the emphasis, but if you record and see the rooting phrases and say
     * things before not locking it, it will be gone, cause the new text will
     * replace it — that is the versioning system in its essence."
     *
     * So the two promises are separate. Choosing the phrase records a fact
     * about this recording, immediately, on the step that chose it
     * (`saveEmphasis`) — it does not wait for a lock that may never come, and
     * on the three answers that now end the ladder early there IS no lock to
     * wait for. Locking is the other promise: these words stop being
     * replaceable by the next take, and the phrase standing on them survives
     * with them.
     *
     * WHAT IS LEFT HERE IS A RE-ANCHOR, NOT THE SAVE. The lock step is also
     * the editor, so the speaker can change the words after picking the
     * phrase — and then the span written on the emphasis step points into text
     * that no longer exists. `dirtyRef` is exactly "they typed", so only then
     * is the phrase resolved again, against the text actually committed, and
     * written once more. On the ordinary path nothing is re-sent.
     *
     * Resolved against the text rather than carried as an offset, for the
     * reason this path always gave: an accepted emphasis rewraps the words in
     * `**`, which moves every raw index after it, while the readable text is
     * stable across that. A quote that no longer resolves locks with no anchor
     * rather than guessing at one.
     *
     * THE GATE READS `judgement`, NOT `agreeValue` — a live bug fix reported
     * from real use 2026-09-16: "I tap to choose the emphasis words, I click
     * lock, and it doesn't save". `agreeValue` is the CHIP's state and
     * advanceStep clears it, deliberately, so a second confident-voice item on
     * the same chunk opens unanswered (L3); by the time the speaker reached
     * Lock it was always null. `judgement` is the paragraph-level answer,
     * which is what this check always meant and which survives the steps in
     * between. It must read the same rule the emphasis step reads, so both
     * call `opensRootPhrase`: the step decides whether to ASK, this decides
     * whether to STORE, and they may never disagree about who is allowed. */
    const confidenceOnly =
      feedbackInventory.length > 0 &&
      feedbackInventory.every(isConfidentVoiceFeedback);
    const reAnchor =
      dirtyRef.current &&
      promotedQuote &&
      !(confidenceOnly && !opensRootPhrase(judgement))
        ? quoteSpan(draft, promotedQuote)
        : null;
    if (reAnchor) await onSetRootPhrase(reAnchor);
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
  /** Write the chosen phrase NOW, on the screen that chose it.
   *
   *  FOUNDER 2026-09-24: "handle it through the emphasis screen not through
   *  the lock ... make the emphasis save the emphasis and lock the text with
   *  the emphasis."
   *
   *  It used to be stored by `lockIn`, which made the lock do two jobs and
   *  made the phrase depend on the second one. That was already the wrong
   *  shape, and removing the Lock step for three of the answers would have
   *  turned it into silent data loss — the speaker taps their words on a
   *  screen that then closes, and nothing is written. The founder's own
   *  reasoning is the better one and it is about versioning, not screens:
   *  the phrase is a fact about this recording the moment it is chosen, while
   *  the lock is what stops a later take replacing the words underneath it.
   *  Two different promises, so two different moments.
   *
   *  A FAILURE STOPS THE LADDER. Returning false here leaves the speaker on
   *  the emphasis screen with `failRoot` showing, rather than advancing past
   *  the only chance to record the words they just picked.
   *
   *  The span is resolved against the text rather than carried as an offset,
   *  for the reason the lock path always gave: an accepted emphasis rewraps
   *  words in `**` and moves every raw index after it, while the readable text
   *  does not. A quote that no longer resolves saves nothing rather than
   *  guessing at a position. */
  async function saveEmphasis(phrase: string | null): Promise<boolean> {
    const anchor = phrase ? quoteSpan(draft, phrase) : null;
    if (!anchor) return true;
    const ok = await onSetRootPhrase(anchor);
    if (!ok) setError(COPY.failRoot);
    return ok;
  }

  async function emphasiseProposed() {
    if (!styleSuggestion || busy) return;
    const chosen = styleSuggestion.quote || null;
    setBusy(true);
    setError(null);
    const saved = await saveEmphasis(chosen);
    setBusy(false);
    if (!saved) return;
    setPromotedQuote(chosen);
    if (onApplyStyle) await applyStyle();
    advanceStep();
  }

  /* TAP-TO-SELECT DOES NOT WRITE A MARKER INTO THE DRAFT, and that is a
     reversal of my own first attempt at "tap to bold immediately" (founder
     2026-09-16).

     IT WENT PAST THE HANDOFF. §5 stores the rooting phrase as a SPAN —
     onSetRootPhrase({text, start, end}) — resolved against the locked text at
     lock time. Folding a marker into the document is what the STYLE LANE does,
     server-side, after onApplyStyle agrees to it. There is no such row for
     words the speaker picked themselves, so the marker was a document edit
     nobody asked for, riding along on the lock. That is the L1 objection and
     it is sufficient on its own.

     IT ALSO DESTABILISED SLIDE EDITING, measured rather than assumed. Marking
     the draft made Lock ALSO save the document, whose refetch churned an open
     slide editor: typing into a slide right afterwards did not reach the save
     unless the walk paused and re-focused first. With this reverted, the
     canonical walk types once and saves the typed words, three runs for three.
     (To be precise about what was NOT the cause: a paragraph that already
     carries a marker — from the style lane — edits and saves correctly. I
     checked that directly in a browser before writing this.)

     What the speaker sees is unchanged and already answers the asymmetry: §6
     renders tapped words in --primary as they are tapped, which is how a
     rooting phrase renders while recording. The preview is immediate; only
     the invented document edit is gone. */
  async function emphasiseChosen() {
    if (busy) return;
    const chosen = selectionText(draft, phraseTokens(draft), phraseRun);
    setBusy(true);
    setError(null);
    const saved = await saveEmphasis(chosen);
    setBusy(false);
    if (!saved) return;
    setPromotedQuote(chosen);
    advanceStep();
  }

  /* skipEmphasis is GONE (founder 2026-09-16, §5). It set promotedQuote to
     null and advanced — a deferral on a step that has nothing to defer. The
     step only appears on a paragraph already judged Yes, and both of its
     remaining actions commit a phrase. A paragraph without an orange phrase
     is one that never reached this screen, which is the gate's job, not a
     button's. promotedQuote still starts null, so the no-phrase path is
     unchanged; only the way to ASK for it from here is gone. */

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
      /* THE PARAGRAPH'S JUDGEMENT, kept where advanceStep's per-item reset
         cannot reach it — and kept WHOLE.
 
         It used to be collapsed to `yes | other` right here, before any gate
         saw it (audit finding F-4). That was survivable while the only
         question was "does emphasis open", which every answer now does. It is
         not survivable now: `closesLock` puts "No" and "In-between" on
         opposite sides of the same collapse, so a sheet that forgets which of
         the five was tapped cannot obey the founder's rule at all. The row
         STATUS stays collapsed, because "did they accept this suggestion"
         really is a yes-or-not question; the judgement itself does not. */
      const answered = value === "yes" ? "yes" : "other";
      setJudgement(value);
      reportJudged(suggestion, answered);
      /* NO SEPARATE "DONE" STEP (founder 2026-09-15: "drop the Done step").
       *
       * Answering WAS the decision; the screen that followed held a thank-you
       * and a button whose only job was to admit it. The answer is already
       * saved by the call above, so the tap bought nothing and cost a screen.
       * Now the answer advances straight to the next feedback, or closes the
       * review when it was the last one.
       *
       * The practice offer used to stop the advance here, because this
       * post-answer screen was the only place it could live. It has its own
       * step now (§3), which is what that guard was waiting for — so the
       * answer advances, and the next screen IS the exercise.
       *
       * No second write: `saveTakeFeedbackResponse` above already recorded
       * this answer, and the retired Done button called it AGAIN through
       * resolveObservedFeedback with the same id and value.
       *
       * IT ADVANCES ON THE RAW ANSWER, for the same reason `judgement` now
       * holds it: React has not re-rendered, so the list this builds is the
       * only one that sees the answer just given — hand it the collapsed
       * `answered` and the ladder keeps a Lock step the founder's rule has
       * just removed, on the one advance where it matters. */
      advanceStep(value);
      return;
    }
    // Roll the chip back rather than leaving it lit over a row the server
    // never took — the same rule the style apply follows.
    setAgreeValue(null);
    if (r.reason === "superseded") {
      setSuperseded(true);
      return;
    }
    setAgreeError(r.error ?? COPY.failResponse);
  }

  /** THE V3 ANSWER, handed back by the question screen (founder 2026-09-21,
   *  "instead of a Done button simply instant acceptance"). The screen saved
   *  it through the service route; this is the one message the sheet was not
   *  getting — so the ladder stood still with no pill and no emphasis rung.
   *  Same three effects as the legacy `sendAgreement`, then the advance. */
  function onServiceAnswered(
    value: ConfidenceRatingValue,
    exerciseAllowed: boolean,
  ): void {
    setAgreeValue(value);
    setAgreeSaved(true);
    // THE ROW STATUS STAYS COLLAPSED; THE ROOTING GATE NO LONGER IS.
    // `judgedStatus` answers "did they accept this suggestion", which only a
    // Yes does, so that mapping is unchanged. The rooting step asks something
    // else — which words matter — and now reads the answer the speaker
    // actually gave, so "Not sure" stops being indistinguishable from "No"
    // and from "Audio unclear" (F-4).
    if (serviceItem) {
      reportJudged(serviceItem, value === "yes" ? "yes" : "other");
    }
    setJudgement(value);
    advanceStep(value, exerciseAllowed);
  }

  /** One place turns a judgement into the row status the host keeps. */
  function reportJudged(
    item: DocumentSuggestion,
    answered: "yes" | "other",
  ): void {
    onJudged?.(item, judgedStatus(answered));
  }

  /** Step three. The hook owns the practice row, the mic and the two screens'
   *  state; the sheet owns what is drawn and the one footer, as every other
   *  step does. A closed practice advances the ladder, and a final Yes is a
   *  judgement of the same delivery — so it supersedes step one's answer for
   *  the emphasis gate. */
  const onExerciseFinished = useCallback((answer: "yes" | "no" | null) => {
    /* NO ANSWER IS NOT THE SAME AS NO JUDGEMENT, and conflating the two was a
     * live defect (founder, shown the case 2026-09-24).
     *
     * `null` here means the practice closed without judging the corrected
     * take — "Not now", or a practice that was never opened server-side. It
     * says nothing about the paragraph, whose Confident Voice answer was given
     * two screens ago and still stands. Passing that null through built the
     * ladder as though NOBODY had judged the paragraph, and `opensRootPhrase`
     * reads an unjudged paragraph as one with no emphasis step — so declining
     * a drill silently cost the speaker their rooting phrase. The step bar
     * still counted it: four segments, the third never visited.
     *
     * Calling with no argument lets the default pick up the paragraph's
     * current `judgement`. The ref is re-pointed every render, so the default
     * it reads is this render's, which is the whole reason the ref exists.
     *
     * ON A "No" THE BUG LOOKED FIXED AND WAS NOT. There is no lock step on
     * that answer any more, so the advance computed "go to Lock", found no
     * such step, and fell back to the last one — which happened to be
     * Emphasis. Right screen, wrong reason, and nothing to rely on. */
    if (answer === null) {
      advanceStepRef.current();
      return;
    }
    // A real judgement of the corrected take supersedes step one's: it is the
    // same delivery, judged later and better informed.
    const answered = answer === "yes" ? "yes" : "other";
    setJudgement(answered);
    advanceStepRef.current(answered);
  }, []);
  const exercise = useConfidenceExercise({
    snippetId: exerciseItem?.snippetId ?? null,
    offer: exerciseItem?.practiceExercise ?? null,
    evidence: exerciseItem?.evidence ?? null,
    // The introduction the offer shows depends on how the speaker judged the
    // original; "other" answers read the same as a No here, which is what the
    // pre-ladder card did.
    originalUserAnswer: judgement === "yes" ? "yes" : "no",
    onFinished: onExerciseFinished,
  });

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
  /* THE TAPPABLE WORDS ARE THE CONFIDENT FRAGMENT (founder 2026-09-17,
     locked): "confident words only — but not only those the user judged as
     confident: the whole fragment suggested for the confidence judgement."
     So the surface is the Confident Voice candidate's own quote, not the
     paragraph around it. Orange means "I confirmed I deliver these words
     well", and it should not be settable on a sentence nobody asked about.
     `tokensWithinFragment` falls back to the whole paragraph when the
     fragment cannot be located, so the step never dead-ends. */
  const tokens =
    step?.kind === "emphasis"
      ? tokensWithinFragment(
          phraseTokens(draft),
          draft,
          confidentFragmentOf(feedbackInventory),
        )
      : [];
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
    // Every feedback screen on a superseded Take has the same single move.
    if (superseded && suggestion) return supersededFooter(() => advanceStep());
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
    if (step.kind === "exercise") {
      // THE SERVICE RUNG draws its own inner actions (self-voice check, the
      // offer, record, preference) and the sheet's footer is the way past it:
      // Done once there is nothing left on the screen, Not now at any time.
      if (step.id === "service_exercise") {
        return serviceExerciseFooter(
          serviceExerciseSettled(service),
          () => advanceStep(),
        );
      }
      // THE JUDGEMENT SCREEN. Done answers it; Back leaves without answering
      // and lands on the offer, where the pill will now read Practise again.
      if (exercise.screen === "judgement") {
        return {
          pill: COPY.pillDone,
          icon: <Check className="h-4 w-4" aria-hidden />,
          pillDisabled: exercise.busy || exercise.corrected === null,
          onPill: () => void exercise.finish(judgement === "yes" ? "yes" : "no"),
          links: [{ label: COPY.linkBack, onClick: () => exercise.back() }],
        };
      }
      // THE OFFER. While the mic is live the pill is the way to end the take;
      // "Not now" would otherwise be the only way to stop it, and that closes
      // the practice rather than keeping the recording.
      if (exercise.recording) {
        return {
          pill: COPY.pillStop,
          icon: <Square className="h-4 w-4" aria-hidden />,
          onPill: () => exercise.stop(),
          links: [],
        };
      }
      return {
        pill: exercise.returned ? COPY.pillPractiseAgain : COPY.pillPractise,
        icon: <Mic className="h-4 w-4" aria-hidden />,
        pillDisabled: exercise.busy,
        onPill: () => exercise.practise(),
        links: [{ label: COPY.linkNotNow, onClick: () => void exercise.notNow() }],
      };
    }
    if (step.kind === "emphasis") {
      const tapping = emphasisTap || !styleSuggestion;
      return {
        pill: COPY.pillEmphasise,
        icon: <Sparkles className="h-4 w-4" aria-hidden />,
        pillDisabled: tapping && phraseRun === null,
        onPill: tapping
          ? () => void emphasiseChosen()
          : () => void emphasiseProposed(),
        /* NO SKIP, on any of the three states (founder 2026-09-16, §5). The
           step offers two choices and no opt-out — take the phrase it
           proposes, or choose the words that fit better — because there is
           nothing to defer: it only appears on a paragraph already judged
           Yes. A paragraph that fails that gate never reaches this screen at
           all, and THAT, not a Skip button, is how a paragraph ends up
           without an orange phrase. The sheet's close button sits here as it
           does on every other screen, so leaving is always available. */
        links: tapping
          ? []
          : [
              {
                label: COPY.linkChooseWords,
                onClick: () => setEmphasisTap(true),
              },
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

  /* ---- what the scroll body shows for the current step -------------------
   * One render function per screen, exactly mirroring the footer's own
   * step.kind switch above. Each is its own named function (rather than one
   * big switch) so it is measured as its own function for the complexity
   * ratchet — the six screens are mutually exclusive by construction
   * (`step.kind` selects exactly one), so this changes nothing about what
   * renders, only where the branching is counted. Each restates the same
   * narrowing its caller already did (`suggestion`/`exerciseItem` non-null)
   * because that narrowing does not cross a function boundary. */
  function renderFeedbackStep(): React.ReactNode {
    if (!suggestion) return null;
    return (
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
          <Mlc3ConfidenceQuestion
            flow={service}
            question={COPY.confidenceQuestion}
            onAnswered={onServiceAnswered}
          />
        ) : !agreeSaved ? (
          <ConfidenceLabelChips
            question={COPY.confidenceQuestion}
            value={agreeValue}
            disabled={agreeSaving || superseded}
            saving={agreeSaving}
            error={agreeError}
            ownerWording
            onPick={(value) => void sendAgreement(value)}
          />
        ) : null}
      </div>
    );
  }

  /* ---- EXERCISE · the offer, then the judgement ------------------
      The one place the asynchronous side of the product reaches this
      sheet. There is NO coach note anywhere here: what a review
      produces is an exercise matched to this exact clip (§3). */
  function renderExerciseStep(): React.ReactNode {
    if (step.id === "service_exercise") {
      return serviceItem ? (
        <Mlc3ExerciseStep flow={service} suggestion={serviceItem} />
      ) : null;
    }
    if (!exerciseItem?.practiceExercise) return null;
    return exercise.screen === "judgement" ? (
      <>
        {/* The corrected take ALONE — the original playback is gone on
            purpose, so the question is about what they just did rather
            than a comparison. Orange, because this is the third and
            last place orange is allowed (§9). */}
        <div className="relative rounded-2xl border border-primary/30 bg-primary/[0.07] p-4">
          <span className="absolute right-4 top-4 text-primary" aria-hidden>
            <Mic className="h-4 w-4" />
          </span>
          <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
            {COPY.cardCorrectedVersion}
          </p>
          {exercise.corrected?.audioRef ? (
            <div className="mt-2.5">
              <MediaPlayer
                src={exercise.corrected.audioRef}
                startOffsetMs={0}
                durationMs={exercise.corrected.durationMs}
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
          <ConfidenceLabelChips
            question={COPY.confidenceQuestion}
            value={judgement === "yes" ? "yes" : null}
            disabled={exercise.busy}
            saving={exercise.busy}
            error={exercise.error}
            ownerWording
            onPick={(value) =>
              setJudgement(value === "yes" ? "yes" : "other")
            }
          />
        </div>
      </>
    ) : (
      /* THE OFFER (founder 2026-09-24). No "what you said" box, no eyebrow, no
         corner icon — the sheet title already says Exercise.

         THE VIDEO LEADS AND THE INSTRUCTION IS PLAIN, and the two are one
         decision. "Exercise should have the video displayed, not the text. Or
         it should have the video and below the text so that it's connected to
         what is uploaded through the exercise upload system" — so the coach's
         own recording is the first thing on the screen, and the words are
         underneath it. It is the same file the CMS exercise lane uploaded:
         videoUrl -> explanation_video_ref -> explanationVideoRef. Nothing new
         is fetched and no second upload path exists.

         AND THE INSTRUCTION LEAVES THE ORANGE BOX: "the instruction should not
         be in the same box, orange box, as the text you are saying, because it
         is confusing." Orange means words that get said; this is us telling
         the speaker what to do with them, so it takes the plain box — the same
         one "What you said" wears on the Suggestion screen, and the same one
         the praise comment now wears next door. There are no spoken words on
         this screen (the offer's `passage` is deliberately not drawn), so the
         screen carries no orange at all. */
      <div data-testid="practice-offer" className="flex flex-col gap-3">
        {exerciseItem.practiceExercise.explanationVideoRef ? (
          <div className="overflow-hidden rounded-2xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={exerciseItem.practiceExercise.explanationVideoRef}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full"
            />
          </div>
        ) : null}
        {/* AN EXERCISE MAY CARRY NO WORDS AT ALL (founder 2026-09-24: the
            CMS lane's words step "is not obligatory"). A video-only exercise
            must not draw an empty bordered box under its clip, so the box
            goes with the text rather than standing there hollow. */}
        {/* `?? ""` because the field is typed string but arrives undefined on
            an offer assembled before it existed — the old render tolerated
            that by printing nothing, and a bare .trim() here threw. */}
        {(exerciseItem.practiceExercise.instruction ?? "").trim() ? (
          <div className="rounded-2xl border border-border p-4">
            <p className="text-[15px] leading-relaxed text-foreground">
              {exerciseItem.practiceExercise.instruction}
            </p>
          </div>
        ) : null}
        {exercise.error ? (
          <p className="rounded-xl border border-border p-3 text-[13px] text-destructive">
            {exercise.error}
          </p>
        ) : null}
      </div>
    );
  }

  /* ---- GOOD JOB · read, not rated -------------------------------
      THE ORANGE IS ON THE SPEAKER'S OWN WORDS (founder 2026-09-24):
      "the box with what you said should be the orange one and the
      comment should be exactly the same as the instruction for the
      exercise. And as what you said on the suggestion, same white
      box." So the two boxes swap.

      It is the colour rule the whole sheet now runs on, confirmed by
      the founder the same day: ORANGE is words that get said — the
      ones that worked here, the ones to say next time on Suggestion —
      and PLAIN is what we are telling the speaker about them. On
      Suggestion "What you said" stays plain because it is being
      replaced; here those words are the keeper, so they take the
      orange.

      "Exactly the same as the instruction for the exercise" is taken
      literally: that box has no eyebrow and no corner icon, so the
      thumbs-up goes with the comment into the plain box and is not
      redrawn. The screen title already says Good job. */
  function renderPraiseStep(): React.ReactNode {
    if (!suggestion) return null;
    return (
      <>
        <div className="rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
          <p className="text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
            {COPY.cardWhatYouSaid}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground">
            {suggestion.quote || chunk.part.text}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-[15px] leading-relaxed text-foreground">
            {suggestion.tentative ? COPY.praiseTentative : PRAISE_LEAD}
          </p>
        </div>
      </>
    );
  }

  /* ---- SUGGESTION · what you said, and the clearer version ------ */
  function renderSuggestionStep(): React.ReactNode {
    if (!suggestion) return null;
    return (
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
    );
  }

  /* ---- EMPHASIS · the only place the orange is decided ---------- */
  function renderEmphasisStep(): React.ReactNode {
    return emphasisTap || !styleSuggestion ? (
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
    );
  }

  /* ---- LOCK · the same last question on every path -------------- */
  function renderLockStep(): React.ReactNode {
    return (
      <div className="relative rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
        {/* A PENCIL, NOT A PADLOCK (founder 2026-09-24): "on the orange box
            the icon should be little pencil in the top right corner instead
            of a lock icon ... although keep the lock icon on the CTA, so the
            button that locks it."

            The icon on the card should say what the card does, and this card
            is the paragraph itself — editable on the editor face, and the
            thing about to be committed on the preview face. The padlock names
            an action, so it belongs on the button that performs it and
            nowhere else. Same card behind both titles, so one change covers
            Lock and Edit this chunk. It is the pencil the Suggestion screen
            already uses for "edit myself", so the app has one pencil. */}
        <span className="absolute right-4 top-4 text-pending" aria-hidden>
          <Pencil className="h-4 w-4" />
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
        {locksAsPreview({
          locked: chunk.part.locked === true,
          hadFeedback,
          chosenPhrase: promotedQuote,
        }) ? (
          <LockPreviewText text={draft} phrase={promotedQuote} />
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
    );
  }

  /* ---- the superseded-Take notice, under whichever feedback screen ------ */
  function renderSupersededNotice(): React.ReactNode {
    if (!superseded || !suggestion) return null;
    return (
      <p
        role="status"
        data-testid="superseded-notice"
        className="rounded-2xl border border-border px-4 py-3 text-[13px] leading-snug text-muted-foreground"
      >
        {COPY.noticeSuperseded}
      </p>
    );
  }

  const stepContent: React.ReactNode =
    step.kind === "feedback" ? renderFeedbackStep() :
    step.kind === "exercise" ? renderExerciseStep() :
    step.kind === "praise" ? renderPraiseStep() :
    step.kind === "suggestion" ? renderSuggestionStep() :
    step.kind === "emphasis" ? renderEmphasisStep() :
    step.kind === "lock" ? renderLockStep() :
    null;

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

          {stepContent}

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
          {renderSupersededNotice()}
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
