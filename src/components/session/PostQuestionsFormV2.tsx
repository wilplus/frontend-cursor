"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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
  const { postAnswers, postCurrentIndex, setPostCurrentIndex, updatePostAnswer, submitPostAnswers, abandonCurrentSession, loading, error } =
    useSessionStore();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [freeTextLocal, setFreeTextLocal] = useState("");

  const isReadOnly = Object.keys(submittedAnswers).length > 0;
  const sorted = (questions ?? []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const total = sorted.length;
  const currentIndex = total > 0 ? Math.min(postCurrentIndex, total - 1) : 0;
  const question = total > 0 ? sorted[currentIndex] : null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;
  const currentAnswer = question ? (postAnswers[question.id] ?? "").trim() : "";
  const isOptional = question?.order_index === 2;
  const freeTextFilled =
    question?.question_type === "free_text" ? (freeTextLocal || "").trim().length > 0 : false;
  const canAdvance = isOptional || currentAnswer.length > 0 || freeTextFilled;

  useEffect(() => {
    if (isReadOnly) return;
    const store = useSessionStore.getState();
    const draftKey = store.recordingId ?? store.sessionId;
    if (!draftKey || Object.keys(postAnswers).length > 0) return;
    const drafts = localStorage.getItem(`willab:draft:post_answers:${draftKey}`);
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
      const stored = postAnswers[question.id] ?? "";
      setFreeTextLocal(stored);
      inputRef.current?.focus();
    }
  }, [currentIndex, question?.id, question?.question_type, isReadOnly, postAnswers]);

  const syncFreeTextToStore = useCallback(
    (questionId: string, value: string) => {
      updatePostAnswer(questionId, value);
    },
    [updatePostAnswer]
  );

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
    if (question?.question_type === "free_text") {
      syncFreeTextToStore(question.id, freeTextLocal);
    }
    if (isLast) {
      doSubmit();
    } else {
      setPostCurrentIndex(Math.min(currentIndex + 1, total - 1));
    }
  }, [canAdvance, isLast, total, currentIndex, question, isOptional, doSubmit, setPostCurrentIndex, freeTextLocal, syncFreeTextToStore]);

  const goBack = useCallback(() => {
    if (isFirst) {
      abandonCurrentSession();
    } else {
      setPostCurrentIndex(Math.max(currentIndex - 1, 0));
    }
  }, [isFirst, currentIndex, abandonCurrentSession, setPostCurrentIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (canAdvance) goNext();
    },
    [canAdvance, goNext]
  );

  // Enter from anywhere (e.g. after clicking a choice) advances or submits
  useEffect(() => {
    if (isReadOnly || !questions?.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !canAdvance || loading) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      e.preventDefault();
      goNext();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [canAdvance, goNext, isReadOnly, loading, questions?.length]);

  const handleScaleClick = (questionId: string, value: number) => {
    updatePostAnswer(questionId, value.toString());
  };

  const handleBinaryClick = (questionId: string, value: "YES" | "NO") => {
    updatePostAnswer(questionId, value);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center gap-3 py-12" aria-label="Submitting">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Submitting…</p>
        </div>
      </Card>
    );
  }

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
        <h3 className="text-lg font-semibold">Take a moment to reflect</h3>
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
                                  ? "border-primary ring-2 ring-primary/30"
                                  : "border-border hover:border-primary/50"
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
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleBinaryClick(question.id, "YES")}
                        className={`flex-1 min-w-0 py-3 px-3 rounded-lg border-2 transition-all ${
                          postAnswers[question.id] === "YES"
                            ? "border-primary shadow-md ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50"
                        }`}
                        disabled={loading}
                      >
                        <span className="text-sm font-medium truncate">YES</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBinaryClick(question.id, "NO")}
                        className={`flex-1 min-w-0 py-3 px-3 rounded-lg border-2 transition-all ${
                          postAnswers[question.id] === "NO"
                            ? "border-primary shadow-md ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50"
                        }`}
                        disabled={loading}
                      >
                        <span className="text-sm font-medium truncate">NO</span>
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
                      value={freeTextLocal}
                      onChange={(e) => setFreeTextLocal(e.target.value)}
                      onBlur={() => syncFreeTextToStore(question.id, freeTextLocal)}
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
