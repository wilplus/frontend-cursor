"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TaskBlockV2 } from "@/lib/api/types-homework";

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

export interface AnswerMetricQuestionsScreenProps {
  sessionId: string;
  taskBlock: TaskBlockV2 | null;
  /** Submit the three answers; parent does POST and then moves to final task step. */
  onSubmit: (answer_1: string, answer_2: string, answer_3: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export default function AnswerMetricQuestionsScreen({
  sessionId,
  taskBlock,
  onSubmit,
  loading = false,
  error: externalError = null,
}: AnswerMetricQuestionsScreenProps) {
  const [answer_1, setAnswer_1] = useState("");
  const [answer_2, setAnswer_2] = useState("");
  const [answer_3, setAnswer_3] = useState("");

  const label1 = taskBlock ? toText(taskBlock.metric_question_1) || "Metric question 1" : "Metric question 1";
  const label2 = taskBlock ? toText(taskBlock.metric_question_2) || "Metric question 2" : "Metric question 2";
  const label3 = taskBlock ? toText(taskBlock.metric_question_3) || "Metric question 3" : "Metric question 3";

  const handleSubmit = () => {
    if (typeof window !== "undefined") {
      console.warn("[HomeworkFlow] metric Continue clicked", { allFilled, loading });
    }
    void onSubmit(answer_1.trim(), answer_2.trim(), answer_3.trim());
  };

  const allFilled = answer_1.trim() !== "" && answer_2.trim() !== "" && answer_3.trim() !== "";

  const inputClass =
    "min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const labelClass = "block text-sm font-medium text-foreground";

  return (
    <div className="answer-metric-questions">
      <div className="p-6 sm:p-8">
        <div className="space-y-8">
          <div className="space-y-3">
            <label className={labelClass}>{label1}</label>
            <textarea
              className={inputClass}
              placeholder="Describe your answer…"
              value={answer_1}
              onChange={(e) => setAnswer_1(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className={labelClass}>{label2}</label>
            <textarea
              className={inputClass}
              placeholder="Describe your answer…"
              value={answer_2}
              onChange={(e) => setAnswer_2(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className={labelClass}>{label3}</label>
            <textarea
              className={inputClass}
              placeholder="Describe your answer…"
              value={answer_3}
              onChange={(e) => setAnswer_3(e.target.value)}
            />
          </div>
        </div>
        {externalError && <p className="mt-4 text-sm text-destructive">{externalError}</p>}
        <Button
          className="mt-8 w-full rounded-xl bg-primary text-white font-normal hover:bg-primary/90 h-12"
          onClick={handleSubmit}
          disabled={loading || !allFilled}
        >
          {loading ? "Submitting…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
