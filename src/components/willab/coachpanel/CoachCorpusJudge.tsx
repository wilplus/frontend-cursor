"use client";

/* -------------------------------------------------------------------------- */
/*  One import's moments, judged blind on the panel's Judge screen (founder   */
/*  lock 2026-10-06, CO1 A: "its moments are judged blind on the same judging */
/*  screen"; build plan D-CP-20).                                              */
/*                                                                            */
/*  What makes a corpus label honest stays exactly as the corpus page keeps   */
/*  it: payload order (N2), no default answer (N3), the visible-render receipt */
/*  before a blind answer (BlindExposureBoundary), the re-review flag, and no */
/*  machine read anywhere (N1): the row carries nothing but ids (the blind   */
/*  read drops even the words field, fetchBlindConfidenceQueue); the clip is */
/*  asked for by snippet through the coach-only playback route. The words of  */
/*  a piece are NEVER drawn here, before or after the label. An answer moves  */
/*  on to the next unlabelled piece by itself, its save running behind it (a  */
/*  refused save brings the coach back to that moment); after the last one,   */
/*  on to the next import (founder 2026-10-21).                               */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { JudgeScreen } from "./CoachPanelScreens";
import type { WalkNav } from "../walk/WalkOverlay";
import { BlindExposureBoundary } from "../BlindExposureBoundary";
import { useCorpusClip } from "@/hooks/useCorpusClip";
import { useVisibleLearningExposure } from "@/hooks/useVisibleLearningExposure";
import { firstUnlabelledIndex, nextUnlabelledIndex } from "@/lib/willab/coachPanel";
import type { AnswerValue } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import {
  fetchBlindConfidenceQueue, type BlindConfidenceQueue, type BlindQueuePiece,
} from "@/services/api/trainingCorpus";
import {
  acknowledgeConfidenceChainRender, buildRatingBody, saveStateRating, type ConfidenceChainBlindHandle,
} from "@/services/api/stateRatings";

export default function CoachCorpusJudge({ importId, topic, onSaved, onSaveFail, onDone, onBack, onClose }: {
  importId: string;
  topic: string;
  /** An answer is saved: "Answer saved", as on a speaker's moment. */
  onSaved: () => void;
  /** A save refused after this import was left: the backend's sentence. */
  onSaveFail: (error: string) => void;
  /** Every moment judged (or the last one passed): on to the next import. */
  onDone: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<BlindConfidenceQueue | null | undefined>(undefined);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    let live = true;
    void fetchBlindConfidenceQueue(importId).then((q) => {
      if (!live) return;
      // An import with no moments is never judged: straight back to the
      // imports, no dead Judge screen and no word of its own.
      if (q && q.queue.length === 0) { onDoneRef.current(); return; }
      setQueue(q);
      if (q) setAt(firstUnlabelledIndex(q.queue.map((p) => p.label !== null)));
    });
    return () => { live = false; };
  }, [importId]);

  const pieces = queue?.queue ?? [];
  const piece: BlindQueuePiece | undefined = pieces[at];
  const playback = useCorpusClip(queue ? piece?.snippetId ?? null : null);

  useVisibleLearningExposure({
    handles: piece?.learningExposures ?? [],
    visibilityKey: `coach-panel-corpus:${importId}:${piece?.snippetId ?? "none"}`,
    enabled: Boolean(queue) && piece !== undefined && piece.label === null,
    actorRole: "coach",
  });

  /** The label drawn on piece `index`, or taken off it again. */
  const labelAt = (index: number, value: AnswerValue | null) => setQueue((q) => q ? { ...q, queue: q.queue.map((p, i) => (i !== index ? p
    : { ...p, label: value === null ? null
      : { value, unrateable: false, confident: value === "yes" ? true : value === "no" ? false : null, intensity: null, note: null } })) } : q);

  /** The answer moves on at once; the save (seconds, on a busy backend)
   *  runs behind it. A refusal takes the label off and brings the coach back
   *  to that moment, or, once this import is left, says so on the panel. */
  function answer(value: AnswerValue, exposureId: string | null): void {
    if (!piece) return;
    const body = buildRatingBody(value);
    if (!body) return;
    if (piece.reReview) body.re_review = true;
    setError(null);
    const index = at;
    const chain = piece.mlc2BlindReview && exposureId ? { handle: piece.mlc2BlindReview, exposureId } : null;
    void saveStateRating(piece.snippetId, body, chain).then((result) => {
      if (result.ok) { onSaved(); return; }
      const sentence = result.error ?? COPY.judgeFail;
      if (!mounted.current) { onSaveFail(sentence); return; }
      labelAt(index, null);
      setAt(index);
      setError(sentence);
      setAttempt((n) => n + 1);
    });
    labelAt(index, value);
    const next = nextUnlabelledIndex(pieces.map((p, i) => i === index || p.label !== null), index);
    if (next >= 0) setAt(next);
    else onDone();
  }

  const nav: WalkNav = {
    label: topic,
    index: at,
    total: Math.max(pieces.length, 1),
    onBack: () => { setError(null); if (at > 0) setAt(at - 1); else onBack(); },
    onNext: () => { setError(null); if (at < pieces.length - 1) setAt(at + 1); else onDone(); },
  };

  if (queue === undefined || !piece) {
    return <JudgeScreen nav={nav} momentId={`${importId}:${at}`} clip={null} error={queue === null ? COPY.readFail : null}
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
