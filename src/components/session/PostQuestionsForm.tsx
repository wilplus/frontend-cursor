"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { PostRecordingQuestion } from "@/lib/api/types";

interface PostQuestionsFormProps {
  questions: PostRecordingQuestion[];
  submittedAnswers?: Record<string, string>; // question_id -> answer_text (from backend)
}

export default function PostQuestionsForm({
  questions,
  submittedAnswers = {},
}: PostQuestionsFormProps) {
  const { postAnswers, updatePostAnswer, submitPostAnswers, loading, error } =
    useSessionStore();

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
    if (store.recordingId && Object.keys(postAnswers).length === 0) {
      // Only load if we don't already have answers
      const drafts = localStorage.getItem(
        `willab:draft:post_answers:${store.recordingId}`
      );
      if (drafts) {
        try {
          const parsed = JSON.parse(drafts);
          // Only set if not already set from backend
          Object.entries(parsed).forEach(([qId, answer]) => {
            if (!submittedAnswers[qId] && typeof answer === "string" && !postAnswers[qId]) {
              updatePostAnswer(qId, answer);
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
      (q) => (postAnswers[q.id] ?? "").trim().length > 0
    );

    if (!allAnswered) {
      toast.error("Please answer the questions before continuing.");
      return;
    }

    await submitPostAnswers();
  };

  // Handle empty questions array
  if (!questions || questions.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Post-Recording Questions</h3>
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
            If questions don&apos;t appear, the upload may not have completed successfully.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Post-Recording Questions</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Please answer these questions after recording.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question) => {
          const answer =
            submittedAnswers[question.id] || postAnswers[question.id] || "";

          return (
            <div key={question.id}>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium">
                  {question.question_text}
                </label>
                <span className="text-xs px-2 py-0.5 bg-muted rounded">
                  {question.question_type}
                </span>
              </div>
              {isReadOnly ? (
                <div className="p-3 bg-muted rounded-md text-sm">
                  {answer || "(No answer provided)"}
                </div>
              ) : (
                <Input
                  value={answer}
                  onChange={(e) => {
                    const value = e.target.value;
                    updatePostAnswer(question.id, value);
                  }}
                  placeholder="Type your answer here..."
                  disabled={loading}
                />
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
