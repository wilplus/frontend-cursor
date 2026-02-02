"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { FlowBackLink } from "@/components/ui/flow-back-button";
import { ProgressPillBar } from "@/components/ui/progress-pill-bar";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { PostRecordingQuestion } from "@/lib/api/types";

interface PostQuestionsFormV2Props {
  questions: PostRecordingQuestion[];
  submittedAnswers?: Record<string, string>;
}

export default function PostQuestionsFormV2({
  questions,
  submittedAnswers = {},
}: PostQuestionsFormV2Props) {
  const { postAnswers, updatePostAnswer, submitPostAnswers, abandonCurrentSession, loading, error } =
    useSessionStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isReadOnly = Object.keys(submittedAnswers).length > 0;
  const sorted = (questions ?? []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const total = sorted.length;
  const question = total > 0 ? sorted[currentIndex] : null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;
  const currentAnswer = question ? (postAnswers[question.id] ?? "").trim() : "";
  const isOptional = question?.order_index === 2;
  const canAdvance = isOptional || currentAnswer.length > 0;

  useEffect(() => {
    if (isReadOnly) return;
    const store = useSessionStore.getState();
    if (!store.recordingId || Object.keys(postAnswers).length > 0) return;
    const drafts = localStorage.getItem(`willab:draft:post_answers:${store.recordingId}`);
    if (!drafts) return;
    try {
      const parsed = JSON.parse(drafts) as Record<string, string>;
      Object.entries(parsed).forEach(([qId, answer]) => {
        if (!submittedAnswers[qId] && typeof answer === "string" && !postAnswers[qId]) {
          updatePostAnswer(qId, answer);
        }
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isReadOnly || !question) return;
    if (question.question_type === "free_text") {
      inputRef.current?.focus();
    }
  }, [currentIndex, question?.id, isReadOnly, question?.question_type]);

  const doSubmit = useCallback(async () => {
    const q1 = sorted[0];
    const q2 = sorted[1];
    const q1Answered = q1 && (postAnswers[q1.id] || "").trim().length > 0;
    const q2Answered = q2 && (postAnswers[q2.id] || "").trim().length > 0;
    if (!q1Answered) {
      toast.error("Please answer the first question (select a number 1-5)");
      return;
    }
    if (!q2Answered) {
      toast.error("Please answer the second question (select YES or NO)");
      return;
    }
    await submitPostAnswers();
  }, [sorted, postAnswers, submitPostAnswers]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      doSubmit();
    },
    [doSubmit]
  );

  const goNext = useCallback(() => {
    if (!canAdvance && question && !isOptional) return;
    if (isLast) {
      doSubmit();
    } else {
      setCurrentIndex((i) => Math.min(i + 1, total - 1));
    }
  }, [canAdvance, isLast, total, question, isOptional, doSubmit]);

  const goBack = useCallback(() => {
    if (isFirst) {
      abandonCurrentSession();
    } else {
      setCurrentIndex((i) => Math.max(i - 1, 0));
    }
  }, [isFirst, abandonCurrentSession]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (canAdvance) goNext();
    },
    [canAdvance, goNext]
  );

  const handleScaleClick = (questionId: string, value: number) => {
    updatePostAnswer(questionId, value.toString());
  };

  const handleBinaryClick = (questionId: string, value: "YES" | "NO") => {
    updatePostAnswer(questionId, value);
  };

  if (!questions || questions.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Post-Recording Reflection</h3>
        <div className="text-center py-8 space-y-4">
          <p className="text-sm text-muted-foreground mb-4">Questions are not available yet.</p>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
              <strong>Backend Issue:</strong> Post-recording questions were not returned.
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              The backend should return 3 questions (scale, binary, free_text) in the upload response.
            </p>
          </div>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">{error}</div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-1">Take a moment to reflect</h3>
        <p className="text-sm text-muted-foreground">
          Answer these questions about your solo speaking experience
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      <ProgressPillBar
        total={total}
        currentIndex={currentIndex}
        aria-label={`Reflection ${currentIndex + 1} of ${total}`}
      />

      <p className="text-muted-foreground text-sm text-center mb-4">
        Reflection {currentIndex + 1} of {total}
      </p>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <div className="min-h-[250px] flex flex-col justify-center">
          {question && (
            <div key={question.id} className="animate-fade-in">
              {question.question_type === "scale" && (
                <div>
                  <label className="block text-lg sm:text-xl font-bold text-foreground mb-4 text-center">
                    {question.question_text}
                  </label>
                  {isReadOnly ? (
                    <div className="p-3 bg-muted rounded-md text-sm">
                      {submittedAnswers[question.id] || postAnswers[question.id] || "(No answer)"}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Low</span>
                      <div className="flex-1 flex gap-1 min-w-0">
                        {[1, 2, 3, 4, 5].map((num) => {
                          const isSelected = postAnswers[question.id] === num.toString();
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleScaleClick(question.id, num)}
                              className={`flex-1 aspect-square min-w-[2.5rem] rounded-lg border-2 transition-all ${
                                isSelected
                                  ? "border-orange-500 scale-110 ring-2 ring-orange-500/30"
                                  : "border-border hover:border-orange-500/50"
                              }`}
                              disabled={loading}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-xs text-muted-foreground">High</span>
                    </div>
                  )}
                </div>
              )}

              {question.question_type === "binary" && (
                <div>
                  <label className="block text-lg sm:text-xl font-bold text-foreground mb-4 text-center">
                    {question.question_text}
                  </label>
                  {isReadOnly ? (
                    <div className="p-3 bg-muted rounded-md text-sm">
                      {submittedAnswers[question.id] || postAnswers[question.id] || "(No answer)"}
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => handleBinaryClick(question.id, "YES")}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                          postAnswers[question.id] === "YES"
                            ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                            : "border-border hover:border-orange-500/50"
                        }`}
                        disabled={loading}
                      >
                        <span className="text-lg font-medium">YES</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBinaryClick(question.id, "NO")}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                          postAnswers[question.id] === "NO"
                            ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                            : "border-border hover:border-orange-500/50"
                        }`}
                        disabled={loading}
                      >
                        <span className="text-lg font-medium">NO</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {question.question_type === "free_text" && (
                <div>
                  <label className="block text-lg sm:text-xl font-bold text-foreground mb-4 text-center">
                    {question.question_text}
                    {isOptional && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">(optional)</span>
                    )}
                  </label>
                  {isReadOnly ? (
                    <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                      {submittedAnswers[question.id] || postAnswers[question.id] || "(No answer provided)"}
                    </div>
                  ) : (
                    <Input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      value={postAnswers[question.id] || ""}
                      onChange={(e) => updatePostAnswer(question.id, e.target.value)}
                      placeholder="Write anything you want (optional)..."
                      disabled={loading}
                      autoFocus
                      className="w-full min-h-[100px] px-4 py-4 bg-card border border-input rounded-xl text-foreground text-lg text-center focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!isReadOnly && (
          <div className="space-y-3">
            {canAdvance && (
              <p className="animate-fade-in text-muted-foreground text-sm text-center mt-3">
                Press <span className="font-medium">Enter ↵</span> or click to continue
              </p>
            )}
            <Button
              type="button"
              onClick={goNext}
              disabled={loading || !canAdvance}
              className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-white hover:opacity-90"
            >
              {isLast ? (loading ? "Submitting..." : "Complete Quest") : "Next"}
            </Button>
            <FlowBackLink onClick={goBack}>back</FlowBackLink>
          </div>
        )}
      </form>
    </Card>
  );
}
