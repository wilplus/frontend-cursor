"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
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
  const { postAnswers, updatePostAnswer, submitPostAnswers, loading, error } =
    useSessionStore();

  const isReadOnly = Object.keys(submittedAnswers).length > 0;

  // Hydrate from backend truth first, then localStorage drafts
  useEffect(() => {
    if (isReadOnly) {
      return;
    }

    const store = useSessionStore.getState();
    if (store.recordingId && Object.keys(postAnswers).length === 0) {
      const drafts = localStorage.getItem(
        `willab:draft:post_answers:${store.recordingId}`
      );
      if (drafts) {
        try {
          const parsed = JSON.parse(drafts);
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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate: Q1 and Q2 must be answered (scale/binary), Q3 is optional
    const q1 = questions[0];
    const q2 = questions[1];

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
  };

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
          <p className="text-sm text-muted-foreground mb-4">
            Questions are not available yet.
          </p>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
              <strong>Backend Issue:</strong> Post-recording questions were not returned.
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              The backend should return 3 questions (scale, binary, free_text) in the upload response.
              Check your Flask backend logs and ensure the <code>/recordings/upload</code> endpoint returns <code>post_questions</code> array.
            </p>
          </div>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Ensure we have exactly 3 questions
  const [q1, q2, q3] = questions.slice(0, 3);
  
  // Log questions for debugging
  useEffect(() => {
    console.log("[PostQuestionsFormV2] Questions received:", questions);
    if (questions && questions.length > 0) {
      questions.forEach((q, idx) => {
        console.log(`[PostQuestionsFormV2] Q${idx + 1}: ID=${q.id}, Type=${q.question_type}, Order=${q.order_index}`);
      });
    }
    console.log("[PostQuestionsFormV2] Q1:", q1);
    console.log("[PostQuestionsFormV2] Q2:", q2);
    console.log("[PostQuestionsFormV2] Q3:", q3);
  }, [questions, q1, q2, q3]);

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Take a moment to reflect</h3>
        <p className="text-sm text-muted-foreground">
          Answer these questions about your solo speaking experience
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Question 1: Scale (1-5) - Solo awareness */}
        {q1 && q1.question_type === "scale" && (
          <div>
            <label className="block text-sm font-medium mb-3">
              1) {q1.question_text}
            </label>
            {isReadOnly ? (
              <div className="p-3 bg-muted rounded-md text-sm">
                {submittedAnswers[q1.id] || postAnswers[q1.id] || "(No answer)"}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Low</span>
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((num) => {
                    const currentValue = postAnswers[q1.id];
                    const isSelected = currentValue === num.toString();
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleScaleClick(q1.id, num)}
                        className={`flex-1 aspect-square rounded-md border-2 transition-all ${
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

        {/* Question 2: Binary (YES/NO) - Solo self-observation */}
        {q2 && q2.question_type === "binary" && (
          <div>
            <label className="block text-sm font-medium mb-3">
              2) {q2.question_text}
            </label>
            {isReadOnly ? (
              <div className="p-3 bg-muted rounded-md text-sm">
                {submittedAnswers[q2.id] || postAnswers[q2.id] || "(No answer)"}
              </div>
            ) : (
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => handleBinaryClick(q2.id, "YES")}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    postAnswers[q2.id] === "YES"
                      ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                      : "border-border hover:border-orange-500/50"
                  }`}
                  disabled={loading}
                >
                  <span className="text-lg font-medium">YES</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBinaryClick(q2.id, "NO")}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    postAnswers[q2.id] === "NO"
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

        {/* Question 3: Free text (optional) - Solo reflection */}
        {q3 && q3.question_type === "free_text" && (
          <div>
            <label className="block text-sm font-medium mb-2">
              3) {q3.question_text}
            </label>
            {isReadOnly ? (
              <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                {submittedAnswers[q3.id] || postAnswers[q3.id] || "(No answer provided)"}
              </div>
            ) : (
              <Input
                value={postAnswers[q3.id] || ""}
                onChange={(e) => updatePostAnswer(q3.id, e.target.value)}
                placeholder="Write anything you want (optional)..."
                disabled={loading}
                className="min-h-[100px]"
              />
            )}
          </div>
        )}

        {!isReadOnly && (
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Submitting..." : "Submit Reflection"}
          </Button>
        )}
      </form>
    </Card>
  );
}
