"use client";

import type { TrainingTake } from "@/services/api/trainings";
import { ChatArtifactPreview } from "./chats/ChatArtifact";

export const readyForReview = (take: TrainingTake) => take.reviewAvailable ?? take.feedbackAvailable;

export default function TakeReviewMessage({ take, count, preview, onOpen }: {
  take: TrainingTake;
  count: number;
  preview: string | null;
  onOpen: () => void;
}) {
  const summary = count ? `${count} practice ${count === 1 ? "run" : "runs"} · Ideal text`
    : preview || "Feedback · Practise · Ideal text";
  return <ChatArtifactPreview data-take-review-message
    title={`Take ${take.takeIndex} · Feedback walk`} preview={summary} onClick={onOpen} />;
}
