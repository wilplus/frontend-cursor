"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    void onSubmit(answer_1.trim(), answer_2.trim(), answer_3.trim());
  };

  const allFilled = answer_1.trim() !== "" && answer_2.trim() !== "" && answer_3.trim() !== "";

  return (
    <div className="answer-metric-questions space-y-4">
      <Card className="p-6 space-y-4">
        <p className="text-sm font-medium">Answer these three questions:</p>
        <div className="space-y-3">
          <label className="block text-sm font-medium field-label">{label1}</label>
          <textarea
            className="field min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Your answer…"
            value={answer_1}
            onChange={(e) => setAnswer_1(e.target.value)}
          />
          <label className="block text-sm font-medium field-label">{label2}</label>
          <textarea
            className="field min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Your answer…"
            value={answer_2}
            onChange={(e) => setAnswer_2(e.target.value)}
          />
          <label className="block text-sm font-medium field-label">{label3}</label>
          <textarea
            className="field min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Your answer…"
            value={answer_3}
            onChange={(e) => setAnswer_3(e.target.value)}
          />
        </div>
        {externalError && <p className="text-sm text-destructive">{externalError}</p>}
        {!allFilled && <p className="text-sm text-muted-foreground">Answer all three questions above to continue.</p>}
        <Button onClick={handleSubmit} disabled={loading || !allFilled}>
          {loading ? "Submitting…" : "Continue"}
        </Button>
      </Card>
    </div>
  );
}
