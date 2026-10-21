"use client";

/* -------------------------------------------------------------------------- */
/*  The training corpus judged blind on the panel's Judge screen (founder     */
/*  lock 2026-10-06, CO1 A; build plan D-CP-20), mixed (founder 2026-10-21,   */
/*  N101): rounds of clips across imports, never one speaker twice in a row,  */
/*  the machine's reads in equal measure, the first round starting with a     */
/*  clip of the import the coach opened (fetchMixedCorpusQueue).              */
/*                                                                            */
/*  What makes a corpus label honest stays exactly as the corpus page keeps   */
/*  it: payload order (N2), no default answer (N3), the visible-render receipt */
/*  before a blind answer (BlindExposureBoundary), the re-review flag, and no */
/*  machine read anywhere (N1): a round carries ids and the import's topic,  */
/*  nothing else; the clip is asked for by snippet through the coach-only    */
/*  playback route. The words of a piece are NEVER drawn here, before or     */
/*  after the label. An answer moves on to the next clip by itself, its save */
/*  running behind it (a refused save brings the coach back to that moment); */
/*  after a round's last clip, once its saves are in, the next round; when   */
/*  none is left, back to the imports.                                       */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { JudgeScreen } from "./CoachPanelScreens";
import type { WalkNav } from "../walk/WalkOverlay";
import { BlindExposureBoundary } from "../BlindExposureBoundary";
import { useCorpusClip } from "@/hooks/useCorpusClip";
import { useVisibleLearningExposure } from "@/hooks/useVisibleLearningExposure";
import { nextUnlabelledIndex } from "@/lib/willab/coachPanel";
import type { AnswerValue } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import { fetchMixedCorpusQueue, type MixedQueuePiece } from "@/services/api/trainingCorpus";
import {
  acknowledgeConfidenceChainRender, buildRatingBody, saveStateRating, type ConfidenceChainBlindHandle,
} from "@/services/api/stateRatings";

export default function CoachCorpusJudge({ startId, topic, onSaved, onSaveFail, onDone, onBack, onClose }: {
  /** The import the coach opened: the first round starts with one of its clips. */
  startId: string;
  /** Its topic: the label while a round loads. */
  topic: string;
  /** An answer is saved: "Answer saved", as on a speaker's moment. */
  onSaved: () => void;
  /** A save refused after the judging was left: the backend's sentence. */
  onSaveFail: (error: string) => void;
  /** Nothing left to judge: back to the imports. */
  onDone: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [pieces, setPieces] = useState<MixedQueuePiece[] | null | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [turning, setTurning] = useState(false);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });
  /** Clips answered in this sitting: never served again by a later round. */
  const answered = useRef(new Set<string>());
  /** This round's saves, each true once kept. */
  const saves = useRef<Promise<boolean>[]>([]);

  useEffect(() => {
    let live = true;
    void fetchMixedCorpusQueue(round === 0 ? startId : null).then((q) => {
      if (!live) return;
      const fresh = q ? q.filter((p) => !answered.current.has(p.snippetId)) : null;
      setTurning(false);
      // Nothing left to judge: straight back to the imports, no dead Judge
      // screen and no word of its own.
      if (fresh && fresh.length === 0) { onDoneRef.current(); return; }
      setPieces(fresh);
      setAt(0);
    });
    return () => { live = false; };
  }, [startId, round]);

  const list = pieces ?? [];
  const piece: MixedQueuePiece | undefined = list[at];
  const playback = useCorpusClip(pieces && !turning ? piece?.snippetId ?? null : null);

  useVisibleLearningExposure({
    handles: piece?.learningExposures ?? [],
    visibilityKey: `coach-panel-corpus:mixed:${piece?.snippetId ?? "none"}`,
    enabled: Boolean(pieces) && !turning && piece !== undefined && piece.label === null,
    actorRole: "coach",
  });

  /** The label drawn on piece `index`, or taken off it again. */
  const labelAt = (index: number, value: AnswerValue | null) => setPieces((q) => q ? q.map((p, i) => (i !== index ? p
    : { ...p, label: value === null ? null
      : { value, unrateable: false, confident: value === "yes" ? true : value === "no" ? false : null, intensity: null, note: null } })) : q);

  /** The round is done: once its saves are in, the next round. A refused
   *  save has already brought the coach back to its moment; they stay. */
  async function nextRound(): Promise<void> {
    setTurning(true);
    const kept = await Promise.all(saves.current);
    saves.current = [];
    if (!mounted.current) return;
    if (kept.some((ok) => !ok)) { setTurning(false); return; }
    setRound((n) => n + 1);
  }

  /** The answer moves on at once; the save (seconds, on a busy backend)
   *  runs behind it. A refusal takes the label off and brings the coach back
   *  to that moment, or, once the judging is left, says so on the panel. */
  function answer(value: AnswerValue, exposureId: string | null): void {
    if (!piece) return;
    const body = buildRatingBody(value);
    if (!body) return;
    if (piece.reReview) body.re_review = true;
    setError(null);
    const index = at;
    const snippetId = piece.snippetId;
    const chain = piece.mlc2BlindReview && exposureId ? { handle: piece.mlc2BlindReview, exposureId } : null;
    answered.current.add(snippetId);
    saves.current.push(saveStateRating(snippetId, body, chain).then((result) => {
      if (result.ok) { onSaved(); return true; }
      answered.current.delete(snippetId);
      const sentence = result.error ?? COPY.judgeFail;
      if (!mounted.current) { onSaveFail(sentence); return false; }
      labelAt(index, null);
      setAt(index);
      setError(sentence);
      setAttempt((n) => n + 1);
      return false;
    }));
    labelAt(index, value);
    const next = nextUnlabelledIndex(list.map((p, i) => i === index || p.label !== null), index);
    if (next >= 0) setAt(next);
    else void nextRound();
  }

  const nav: WalkNav = {
    label: piece?.topic || topic,
    index: at,
    total: Math.max(list.length, 1),
    onBack: () => { setError(null); if (at > 0) setAt(at - 1); else onBack(); },
    onNext: () => { setError(null); if (at < list.length - 1) setAt(at + 1); else void nextRound(); },
  };

  if (pieces === undefined || turning || !piece) {
    return <JudgeScreen nav={nav} momentId={`mixed:${round}:${at}`} clip={null} error={pieces === null ? COPY.readFail : null}
      attempt={0} onAnswer={() => undefined} onClose={onClose} />;
  }

  return (
    <BlindExposureBoundary<ConfidenceChainBlindHandle>
      key={piece.reviewActId}
      blindReview={piece.mlc2BlindReview}
      acknowledge={acknowledgeConfidenceChainRender}
      scope="coach-card"
      className="h-full"
    >
      {({ exposureId, error: renderError }) => (
        <JudgeScreen
          nav={nav}
          momentId={piece.snippetId}
          clip={playback.clip}
          error={error ?? renderError ?? playback.error}
          attempt={attempt}
          // The chain's receipt never blocks the coach's own label (Q2).
          onAnswer={(value) => answer(value, exposureId)}
          onSkip={nav.onNext}
          onClose={onClose}
        />
      )}
    </BlindExposureBoundary>
  );
}
