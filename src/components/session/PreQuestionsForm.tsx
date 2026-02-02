"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { FlowBackLink } from "@/components/ui/flow-back-button";
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

  const isReadOnly = Object.keys(submittedAnswers).length > 0;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allAnswered = questions.every((q) => (preAnswers[q.id] ?? "").trim().length > 0);
    if (!allAnswered) {
      toast.error("Please answer the question before continuing.");
      return;
    }
    await submitPreAnswers();
  };

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

  const sorted = [...questions].sort((a, b) => getOrderIndex(a) - getOrderIndex(b));
  const question = sorted[0];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Pre-recording question</h3>
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <PreQuestionField
          question={question}
          value={submittedAnswers[question.id] ?? preAnswers[question.id] ?? ""}
          readOnly={isReadOnly}
          loading={loading}
          onValueChange={(value) => updatePreAnswer(question.id, value)}
        />
        {!isReadOnly && (
          <div className="space-y-3">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Submitting..." : "Continue"}
            </Button>
            <FlowBackLink onClick={() => goBackToPreQuestionnaire()} />
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
}: {
  question: PreQuestion;
  value: string;
  readOnly: boolean;
  loading: boolean;
  onValueChange: (v: string) => void;
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
        <label className="block text-sm font-medium mb-2">{question.question_text}</label>
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
        <label className="block text-sm font-medium mb-2">{question.question_text}</label>
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
        <label className="block text-sm font-medium mb-2">{question.question_text}</label>
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
  const isInvalid = value.length > 0 && value.length < 10;
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{question.question_text}</label>
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="Type your answer..."
        disabled={loading}
        className={isInvalid ? "border-destructive" : ""}
      />
      {isInvalid && (
        <p className="text-xs text-destructive mt-1">At least 10 characters for short text.</p>
      )}
    </div>
  );
}
