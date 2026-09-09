"use client";

import { useEffect, useRef, useState } from "react";
import MediaPlayer from "@/components/results/MediaPlayer";
import ConfidenceLabelChips from "./ConfidenceLabelChips";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import {
  completeFirstClientCoachReview,
  confirmFirstClientCoachRender,
  submitFirstClientCoachJudgment,
  type FirstClientCoachDecision,
  type FirstClientCoachReviewSet,
} from "@/services/api/coachGuidanceDelivery";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? "";
}

function decision(value: ConfidenceRatingValue): FirstClientCoachDecision {
  if (value === "yes") return "rating_yes";
  if (value === "in_between") return "rating_in_between";
  if (value === "no") return "rating_no";
  if (value === "not_sure") return "rating_not_sure";
  return "rating_audio_unclear";
}

function value(decisionValue: FirstClientCoachDecision | null):
  ConfidenceRatingValue | null {
  if (decisionValue === "rating_yes") return "yes";
  if (decisionValue === "rating_in_between") return "in_between";
  if (decisionValue === "rating_no") return "no";
  if (decisionValue === "rating_not_sure") return "not_sure";
  if (decisionValue === "rating_audio_unclear") return "audio_unclear";
  return null;
}

export default function FirstClientCoachBlindReview({
  reviewSet,
  onComplete,
}: {
  reviewSet: FirstClientCoachReviewSet;
  onComplete: (reviewSetId: string, revealGrantId: string) => void;
}) {
  const renderIds = useRef<Record<string, string>>({});
  const receiptIds = useRef<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, FirstClientCoachDecision>>(
    () => Object.fromEntries(
      reviewSet.assignments
        .filter((item) => item.judgment !== null)
        .map((item) => [item.assignmentId, item.judgment!]),
    ),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void Promise.all(reviewSet.assignments.map(async (assignment) => {
      if (assignment.judgment) return;
      const renderId = renderIds.current[assignment.assignmentId] || newId();
      renderIds.current[assignment.assignmentId] = renderId;
      const receipt = await confirmFirstClientCoachRender(assignment, renderId);
      if (alive && receipt) receiptIds.current[assignment.assignmentId] = receipt;
      if (alive && !receipt) setError("Couldn't confirm this blind review view.");
    }));
    return () => { alive = false; };
  }, [reviewSet]);

  useEffect(() => {
    const complete = reviewSet.assignments.every(
      (item) => answers[item.assignmentId] !== undefined,
    );
    if (!complete) return;
    let alive = true;
    void completeFirstClientCoachReview(reviewSet.reviewSetId).then((grant) => {
      if (alive && grant) onComplete(reviewSet.reviewSetId, grant);
      if (alive && !grant) setError("Both judgments were saved, but reveal is not ready.");
    });
    return () => { alive = false; };
  }, [answers, onComplete, reviewSet]);

  async function answer(
    assignmentId: string,
    answerValue: ConfidenceRatingValue,
  ) {
    const assignment = reviewSet.assignments.find(
      (item) => item.assignmentId === assignmentId,
    );
    if (!assignment || saving) return;
    const receipt = receiptIds.current[assignmentId];
    if (!receipt) {
      setError("This clip is still preparing. Try again.");
      return;
    }
    setSaving(assignmentId);
    setError("");
    const result = await submitFirstClientCoachJudgment(
      assignment, receipt, decision(answerValue),
    );
    setSaving(null);
    if (!result) {
      setError("Couldn't save that blind judgment. Try again.");
      return;
    }
    setAnswers((current) => ({
      ...current,
      [assignmentId]: decision(answerValue),
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      {reviewSet.assignments.map((assignment) => (
        <section
          key={assignment.assignmentId}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Blind clip
          </p>
          <MediaPlayer
            src={assignment.audioRef}
          />
          <div className="mt-4">
            <ConfidenceLabelChips
              question="Was this voice confident?"
              value={value(answers[assignment.assignmentId] ?? null)}
              unrateable={answers[assignment.assignmentId] === "rating_audio_unclear"}
              disabled={saving === assignment.assignmentId}
              saving={saving === assignment.assignmentId}
              error={null}
              onPick={(next) => void answer(assignment.assignmentId, next)}
            />
          </div>
        </section>
      ))}
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}
