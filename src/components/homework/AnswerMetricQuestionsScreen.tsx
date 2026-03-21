"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuestionBlockV2 } from "@/lib/api/types-homework";

/** Coerce API value to string; backend may send { text } or plain string. */
function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text: unknown }).text;
    return typeof t === "string" ? t : String(t ?? "");
  }
  return String(v);
}

export interface AnswerQuestionPromptsScreenProps {
  sessionId: string;
  taskBlock: QuestionBlockV2 | null;
  /** Submit the three answers; parent does POST and then moves to final task step. */
  onSubmit: (answer_1: string, answer_2: string, answer_3: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  /** When provided, shows an "Abandon session" button so the user can leave the step when stuck. */
  onAbandon?: () => void;
  /** When true, Continue is disabled (e.g. recording analysis failed and submitting again won't help). */
  submitDisabled?: boolean;
}

export default function AnswerQuestionPromptsScreen({
  sessionId,
  taskBlock,
  onSubmit,
  loading = false,
  error: externalError = null,
  onAbandon,
  submitDisabled = false,
}: AnswerQuestionPromptsScreenProps) {
  const [answer_1, setAnswer_1] = useState("");
  const [answer_2, setAnswer_2] = useState("");
  const [answer_3, setAnswer_3] = useState("");

  const b1 = taskBlock ? toText(taskBlock.metric_question_1).trim() : "";
  const b2 = taskBlock ? toText(taskBlock.metric_question_2).trim() : "";
  const b3 = taskBlock ? toText(taskBlock.metric_question_3).trim() : "";
  const hasAnyFromBackend = b1 !== "" || b2 !== "" || b3 !== "";
  const visibleQuestions: { label: string; value: string; setValue: (s: string) => void }[] = hasAnyFromBackend
    ? [
        b1 && { label: b1, value: answer_1, setValue: setAnswer_1 },
        b2 && { label: b2, value: answer_2, setValue: setAnswer_2 },
        b3 && { label: b3, value: answer_3, setValue: setAnswer_3 },
      ].filter(Boolean) as { label: string; value: string; setValue: (s: string) => void }[]
    : [
        { label: "Question 1", value: answer_1, setValue: setAnswer_1 },
        { label: "Question 2", value: answer_2, setValue: setAnswer_2 },
        { label: "Question 3", value: answer_3, setValue: setAnswer_3 },
      ];

  const handleSubmit = () => {
    void onSubmit(answer_1.trim(), answer_2.trim(), answer_3.trim());
  };

  const allFilled = visibleQuestions.every((q) => q.value.trim() !== "");

  const inputClass =
    "min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base sm:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const labelClass = "block text-sm font-medium text-foreground";

  return (
    <div className="answer-question-prompts w-full max-w-xl sm:max-w-2xl mx-auto">
      <div className="p-4 sm:p-6 md:p-8">
        <div className="space-y-8">
          {visibleQuestions.map((q, i) => (
            <div key={i} className="space-y-3">
              <label className={labelClass}>{q.label}</label>
              <textarea
                className={inputClass}
                placeholder="Describe your answer…"
                value={q.value}
                onChange={(e) => q.setValue(e.target.value)}
              />
            </div>
          ))}
        </div>
        {externalError && <p className="mt-4 text-sm text-destructive">{externalError}</p>}
        <Button
          className="mt-8 w-full rounded-xl bg-primary text-white font-normal hover:bg-primary/90 h-12"
          onClick={handleSubmit}
          disabled={loading || !allFilled || submitDisabled}
        >
          {loading ? "Submitting…" : submitDisabled ? "Can't continue" : "Continue"}
        </Button>
        {onAbandon && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={onAbandon}
              disabled={loading}
            >
              Abandon session
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
