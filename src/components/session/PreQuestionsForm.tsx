"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { PreRecordingQuestion } from "@/lib/api/types";

interface PreQuestionsFormProps {
  questions: PreRecordingQuestion[];
  submittedAnswers?: Record<string, string>; // question_id -> answer_text (from backend)
}

export default function PreQuestionsForm({
  questions,
  submittedAnswers = {},
}: PreQuestionsFormProps) {
  const { preAnswers, updatePreAnswer, submitPreAnswers, loading, error } =
    useSessionStore();
  
  // Debug: Log if loading is stuck
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn("Loading state has been true for more than 5 seconds");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const isReadOnly = Object.keys(submittedAnswers).length > 0;

  // Hydrate from backend truth first, then localStorage drafts
  // Only run once on mount, not on every update
  useEffect(() => {
    if (isReadOnly) {
      // Backend truth takes priority
      return;
    }

    // Load drafts from localStorage if backend missing
    const store = useSessionStore.getState();
    if (store.sessionId && Object.keys(preAnswers).length === 0) {
      // Only load if we don't already have answers
      const drafts = localStorage.getItem(
        `willab:draft:pre_answers:${store.sessionId}`
      );
      if (drafts) {
        try {
          const parsed = JSON.parse(drafts);
          // Only set if not already set from backend
          Object.entries(parsed).forEach(([qId, answer]) => {
            if (!submittedAnswers[qId] && typeof answer === "string" && !preAnswers[qId]) {
              updatePreAnswer(qId, answer);
            }
          });
        } catch {
          // Ignore parse errors
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allAnswered = questions.every(
      (q) => (preAnswers[q.id] || "").trim().length >= 10
    );

    if (!allAnswered) {
      toast.error("All answers must be at least 10 characters");
      return;
    }

    await submitPreAnswers();
  };

  // Handle empty questions array
  if (!questions || questions.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pre-Recording Questions</h3>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">
            Questions are loading...
          </p>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            If questions don't appear, you may need to start a new session.
          </p>
        </div>
      </Card>
    );
  }

  const sortedQuestions = [...questions].sort(
    (a, b) => a.order_index - b.order_index
  );

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Pre-Recording Questions</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Please answer these questions before recording (minimum 10 characters
        each).
      </p>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Removed loading state warning - it was showing incorrectly */}

      <form onSubmit={handleSubmit} className="space-y-6">
        {sortedQuestions.map((question) => {
          const answer =
            submittedAnswers[question.id] || preAnswers[question.id] || "";
          const isInvalid = !isReadOnly && answer.length > 0 && answer.length < 10;

          return (
            <div key={question.id}>
              <label className="block text-sm font-medium mb-2">
                {question.question_text}
              </label>
              {isReadOnly ? (
                <div className="p-3 bg-muted rounded-md text-sm">
                  {answer || "(No answer provided)"}
                </div>
              ) : (
                <>
                  <Input
                    value={answer}
                    onChange={(e) => {
                      const value = e.target.value;
                      updatePreAnswer(question.id, value);
                    }}
                    placeholder="Type your answer here..."
                    disabled={loading}
                    className={isInvalid ? "border-destructive" : ""}
                  />
                  {isInvalid && (
                    <p className="text-xs text-destructive mt-1">
                      Answer must be at least 10 characters
                    </p>
                  )}
                  {answer.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {answer.length} characters
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}

        {!isReadOnly && (
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Submitting..." : "Submit Answers"}
          </Button>
        )}
      </form>
    </Card>
  );
}
