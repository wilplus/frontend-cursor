"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HomeworkQuestion } from "@/lib/api/types-homework";

function toId(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "id" in v) {
    const id = (v as { id: unknown }).id;
    return typeof id === "string" ? id : String(id ?? "");
  }
  return String(v);
}

function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text: unknown }).text;
    return typeof t === "string" ? t : String(t ?? "");
  }
  return String(v);
}

export interface PostQuestionsStepScreenProps {
  questions: HomeworkQuestion[];
  /** Submit the answers; parent does POST and then advances. */
  onSubmit: (answers: Record<string, string>) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export default function PostQuestionsStepScreen({
  questions,
  onSubmit,
  loading = false,
  error: externalError = null,
}: PostQuestionsStepScreenProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleChange = (qId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const allAnswered =
    questions.length === 0 ||
    questions.every((q) => (answers[toId(q.id)] ?? "").trim() !== "");

  const handleSubmit = () => {
    const out: Record<string, string> = {};
    questions.forEach((q) => {
      const id = toId(q.id);
      out[id] = (answers[id] ?? "").trim();
    });
    void onSubmit(out);
  };

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Reflective questions</h3>
      <div className="space-y-4">
        {questions.map((q) => {
          const qId = toId(q.id);
          return (
            <div key={qId}>
              <label className="block text-sm font-medium mb-1">{toText(q.text)}</label>
              <textarea
                className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Your answer…"
                value={answers[qId] ?? ""}
                onChange={(e) => handleChange(qId, e.target.value)}
              />
            </div>
          );
        })}
      </div>
      {externalError && <p className="text-sm text-destructive">{externalError}</p>}
      <Button
        onClick={handleSubmit}
        disabled={loading || !allAnswered}
      >
        {loading ? "Submitting…" : "See my report"}
      </Button>
      {!allAnswered && questions.length > 0 && (
        <p className="text-sm text-muted-foreground">Answer all questions above to continue.</p>
      )}
    </Card>
  );
}
