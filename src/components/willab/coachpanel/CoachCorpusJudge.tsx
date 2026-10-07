"use client";

/* -------------------------------------------------------------------------- */
/*  One import's moments, judged blind on the panel's Judge screen (founder   */
/*  lock 2026-10-06, CO1 A: "its moments are judged blind on the same judging */
/*  screen"; build plan D-CP-20).                                              */
/*                                                                            */
/*  What makes a corpus label honest stays exactly as the corpus page keeps   */
/*  it: payload order (N2), no default answer (N3), the visible-render receipt */
/*  before a blind answer (BlindExposureBoundary), the re-review flag, and no */
/*  machine read anywhere (N1): the row carries nothing but ids; the clip is  */
/*  asked for by snippet through the coach-only playback route. The words of  */
/*  a piece are NEVER drawn here, before or after the label. An answer moves  */
/*  on to the next unlabelled piece by itself; after the last one, back to    */
/*  the imports.                                                              */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { JudgeScreen } from "./CoachPanelScreens";
import type { WalkNav } from "../walk/WalkOverlay";
import { BlindExposureBoundary } from "../CoachInlineBlindExposureBoundary";
import { useCorpusClip } from "@/hooks/useCorpusClip";
import { useVisibleLearningExposure } from "@/hooks/useVisibleLearningExposure";
import { firstUnlabelledIndex, nextUnlabelledIndex } from "@/lib/willab/coachPanel";
import type { AnswerValue } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import { fetchConfidenceQueue, type ConfidenceQueue, type QueuePiece } from "@/services/api/trainingCorpus";
import {
  acknowledgeCoachInlineBlindRender, acknowledgeConfidenceChainRender, buildRatingBody, saveStateRating,
  type BlindRenderResult, type CoachInlineBlindReviewHandle, type ConfidenceChainBlindHandle,
} from "@/services/api/stateRatings";

type BlindHandle = CoachInlineBlindReviewHandle | ConfidenceChainBlindHandle;

function blindHandle(piece: QueuePiece): BlindHandle | null {
  return piece.blindReview ?? piece.mlc2BlindReview;
}

function acknowledge(
  handle: BlindHandle,
  request: { renderInstanceId: string; clientRenderedAt: string; idempotencyKey: string },
): Promise<BlindRenderResult> {
  return "blindPacketId" in handle
    ? acknowledgeCoachInlineBlindRender(handle, request)
    : acknowledgeConfidenceChainRender(handle, request);
}

export default function CoachCorpusJudge({ importId, topic, onDone, onBack, onClose }: {
  importId: string;
  topic: string;
  /** Every moment judged (or the last one passed): back to the imports. */
  onDone: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<ConfidenceQueue | null | undefined>(undefined);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);

  useEffect(() => {
    let live = true;
    void fetchConfidenceQueue(importId).then((q) => {
      if (!live) return;
      setQueue(q);
      if (q) setAt(firstUnlabelledIndex(q.queue.map((p) => p.label !== null)));
    });
    return () => { live = false; };
  }, [importId]);

  const pieces = queue?.queue ?? [];
  const piece: QueuePiece | undefined = pieces[at];
  const playback = useCorpusClip(queue ? piece?.snippetId ?? null : null);

  useVisibleLearningExposure({
    handles: piece?.learningExposures ?? [],
    visibilityKey: `coach-panel-corpus:${importId}:${piece?.snippetId ?? "none"}`,
    enabled: Boolean(queue) && piece !== undefined && piece.label === null,
    actorRole: "coach",
  });

  async function answer(value: AnswerValue, exposureId: string | null): Promise<void> {
    if (!piece || saving.current) return;
    const body = buildRatingBody(value);
    if (!body) return;
    if (piece.reReview) body.re_review = true;
    saving.current = true;
    setError(null);
    const chain = piece.mlc2BlindReview && exposureId ? { handle: piece.mlc2BlindReview, exposureId } : null;
    const result = await saveStateRating(piece.snippetId, body, piece.blindReview, exposureId, chain);
    saving.current = false;
    if (!result.ok) {
      setError(result.error ?? COPY.judgeFail);
      setAttempt((n) => n + 1);
      return;
    }
    const labelled = pieces.map((p, i) => i === at || p.label !== null);
    setQueue((q) => q ? { ...q, queue: q.queue.map((p, i) => (i === at
      ? { ...p, label: { value, unrateable: false, confident: value === "yes" ? true : value === "no" ? false : null, intensity: null, note: null } }
      : p)) } : q);
    const next = nextUnlabelledIndex(labelled, at);
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
    <BlindExposureBoundary<BlindHandle>
      key={piece.reviewActId}
      blindReview={blindHandle(piece)}
      acknowledge={acknowledge}
      scope={piece.blindReview ? "coach-inline" : "coach-card"}
      className="h-full"
    >
      {({ exposureId, error: renderError }) => (
        <JudgeScreen
          nav={nav}
          momentId={piece.snippetId}
          clip={playback.clip}
          error={error ?? renderError ?? playback.error}
          attempt={attempt}
          onAnswer={(value) => {
            // A D5 answer needs its exact exposure; the legacy card's receipt
            // never blocks the coach's own label (Q2).
            if (piece.blindReview && !exposureId) return;
            void answer(value, exposureId);
          }}
          onClose={onClose}
        />
      )}
    </BlindExposureBoundary>
  );
}
