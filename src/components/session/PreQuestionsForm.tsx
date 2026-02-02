"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { FlowBackLink } from "@/components/ui/flow-back-button";
import { ProgressPillBar } from "@/components/ui/progress-pill-bar";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { PreQuestion, PreQuestionType } from "@/lib/api/types";

interface PreQuestionsFormProps {
  questions: PreQuestion[];
  submittedAnswers?: Record<string, string>;
}

function getOrderIndex(q: PreQuestion): number {
  return "order_index" in q && typeof q.order_index === "number" ? q.order_index : 0;
}

export default function PreQuestionsForm({
  questions,
  submittedAnswers = {},
}: PreQuestionsFormProps) {
  const { preAnswers, updatePreAnswer, submitPreAnswers, goBackToPreQuestionnaire, loading, error } =
    useSessionStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = Object.keys(submittedAnswers).length > 0;
  const sorted = (questions ?? []).slice().sort((a, b) => getOrderIndex(a) - getOrderIndex(b));
  const total = sorted.length;
  const question = total > 0 ? sorted[currentIndex] : null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;
  const currentAnswer = question ? (preAnswers[question.id] ?? "").trim() : "";
  const canAdvance = currentAnswer.length > 0;

  useEffect(() => {
    if (isReadOnly) return;
    const store = useSessionStore.getState();
    if (!store.sessionId || Object.keys(preAnswers).length > 0) return;
    const drafts = localStorage.getItem(`willab:draft:pre_answers:${store.sessionId}`);
    if (!drafts) return;
    try {
      const parsed = JSON.parse(drafts) as Record<string, string>;
      Object.entries(parsed).forEach(([qId, answer]) => {
        if (!submittedAnswers[qId] && typeof answer === "string" && !preAnswers[qId]) {
          updatePreAnswer(qId, answer);
        }
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus text input when question changes
  useEffect(() => {
    if (isReadOnly || !question) return;
    const type: PreQuestionType = question.question_type ?? "text_short";
    if (type === "text_short") {
      inputRef.current?.focus();
    }
  }, [currentIndex, question?.id, isReadOnly, question?.question_type]);

  const doSubmit = useCallback(async () => {
    const allAnswered = sorted.every((q) => (preAnswers[q.id] ?? "").trim().length > 0);
    if (!allAnswered) {
      toast.error("Please answer the question before continuing.");
      return;
    }
    await submitPreAnswers();
  }, [sorted, preAnswers, submitPreAnswers]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      doSubmit();
    },
    [doSubmit]
  );

  const goNext = useCallback(() => {
    if (!canAdvance && question) return;
    if (isLast) {
      doSubmit();
    } else {
      setCurrentIndex((i) => Math.min(i + 1, total - 1));
    }
  }, [canAdvance, isLast, total, question, doSubmit]);

  const goBack = useCallback(() => {
    if (isFirst) {
      goBackToPreQuestionnaire();
    } else {
      setCurrentIndex((i) => Math.max(i - 1, 0));
    }
  }, [isFirst, goBackToPreQuestionnaire]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (canAdvance) goNext();
      }
    },
    [canAdvance, goNext]
  );

  if (!questions || questions.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pre-recording question</h3>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">Questions are loading...</p>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Pre-recording question</h3>
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      <ProgressPillBar
        total={total}
        currentIndex={currentIndex}
        aria-label={`Question ${currentIndex + 1} of ${total}`}
      />

      <p className="text-muted-foreground text-sm text-center mb-4">
        Question {currentIndex + 1} of {total}
      </p>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <div className="min-h-[200px] flex flex-col justify-center">
          {question && (
            <div key={question.id} className="animate-fade-in">
              <PreQuestionField
                question={question}
                value={submittedAnswers[question.id] ?? preAnswers[question.id] ?? ""}
                readOnly={isReadOnly}
                loading={loading}
                onValueChange={(value) => updatePreAnswer(question.id, value)}
                inputRef={inputRef}
              />
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
              {isLast ? (loading ? "Submitting..." : "Continue") : "Next"}
            </Button>
            <FlowBackLink onClick={goBack}>back</FlowBackLink>
          </div>
        )}
      </form>
    </Card>
  );
}

function PreQuestionField({
  question,
  value,
  readOnly,
  loading,
  onValueChange,
  inputRef,
}: {
  question: PreQuestion;
  value: string;
  readOnly: boolean;
  loading: boolean;
  onValueChange: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const type: PreQuestionType = question.question_type ?? "text_short";

  if (readOnly) {
    return (
      <div>
        <label className="block text-sm font-medium mb-2">{question.question_text}</label>
        <div className="p-3 bg-muted rounded-md text-sm">{value || "(No answer provided)"}</div>
      </div>
    );
  }

  if (type === "scale_1_5") {
    return (
      <div>
        <label className="block text-lg sm:text-xl font-bold text-foreground mb-4 text-center">
          {question.question_text}
        </label>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = value === String(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => onValueChange(String(n))}
                disabled={loading}
                className={`min-w-[2.5rem] py-3 px-4 rounded-lg border-2 transition-all ${
                  selected
                    ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                    : "border-border hover:border-orange-500/50"
                }`}
              >
                <span className={selected ? "font-semibold text-orange-600 dark:text-orange-400" : ""}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "binary_yes_no") {
    return (
      <div>
        <label className="block text-lg sm:text-xl font-bold text-foreground mb-4 text-center">
          {question.question_text}
        </label>
        <div className="flex gap-4">
          {(["Yes", "No"] as const).map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onValueChange(opt)}
                disabled={loading}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  selected
                    ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                    : "border-border hover:border-orange-500/50"
                }`}
              >
                <p className={`text-sm font-medium ${selected ? "text-orange-600 dark:text-orange-400" : ""}`}>{opt}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "binary_choice") {
    return (
      <div>
        <label className="block text-lg sm:text-xl font-bold text-foreground mb-4 text-center">
          {question.question_text}
        </label>
        <div className="flex gap-4">
          {(["Personal", "Neutral"] as const).map((opt) => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onValueChange(opt)}
                disabled={loading}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  selected
                    ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                    : "border-border hover:border-orange-500/50"
                }`}
              >
                <p className={`text-sm font-medium ${selected ? "text-orange-600 dark:text-orange-400" : ""}`}>{opt}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // text_short (default)
  return (
    <div>
      <label className="block text-lg sm:text-xl font-bold text-foreground mb-4 text-center">
        {question.question_text}
      </label>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="Type your answer..."
        disabled={loading}
        autoFocus
        className="w-full px-4 py-4 bg-card border border-input rounded-xl text-foreground text-lg text-center focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
