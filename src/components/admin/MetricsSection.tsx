"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PITCH_VARIANCE_DESCRIPTION = "low … high";

export interface MetricsSectionProps {
  metricQuestion1: string;
  metricQuestion2: string;
  metricQuestion3: string;
  onSave: (data: { metricQuestion1: string; metricQuestion2: string; metricQuestion3: string }) => void | Promise<void>;
  saving?: boolean;
}

export default function MetricsSection({
  metricQuestion1: initial1,
  metricQuestion2: initial2,
  metricQuestion3: initial3,
  onSave,
  saving = false,
}: MetricsSectionProps) {
  const [q1, setQ1] = useState(initial1);
  const [q2, setQ2] = useState(initial2);
  const [q3, setQ3] = useState(initial3);
  const [editingIndex, setEditingIndex] = useState<1 | 2 | 3 | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setQ1(initial1);
    setQ2(initial2);
    setQ3(initial3);
  }, [initial1, initial2, initial3]);

  const values = [q1, q2, q3];
  const setters = [setQ1, setQ2, setQ3];

  const startEdit = (index: 1 | 2 | 3) => {
    setEditingIndex(index);
    setDraft(values[index - 1] || "");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraft("");
  };

  const saveEdit = async () => {
    const text = draft.trim();
    if (editingIndex === null) return;
    setters[editingIndex - 1](text);
    setEditingIndex(null);
    setDraft("");
    const next = [...values];
    next[editingIndex - 1] = text;
    await onSave({
      metricQuestion1: next[0] ?? "",
      metricQuestion2: next[1] ?? "",
      metricQuestion3: next[2] ?? "",
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Metrics (1 fixed + 3 custom)</p>
      <ul className="space-y-2">
        {/* 1. Pitch Variance — fixed */}
        <li
          className={cn(
            "rounded-xl border border-border bg-card p-4 shadow-sm",
            "flex flex-col gap-1"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Pitch Variance</span>
            <span className="text-xs text-muted-foreground">fixed</span>
          </div>
          <p className="text-sm text-muted-foreground">{PITCH_VARIANCE_DESCRIPTION}</p>
        </li>

        {/* 2–4. Metric Question 1, 2, 3 — editable */}
        {([1, 2, 3] as const).map((index) => {
          const isEditing = editingIndex === index;
          const value = values[index - 1] ?? "";

          return (
            <li
              key={index}
              className={cn(
                "rounded-xl border border-border bg-card p-4 shadow-sm",
                "flex flex-col gap-2"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Metric Question {index}</span>
                <span className="text-xs text-muted-foreground">(editable)</span>
              </div>
              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    placeholder={`e.g. What is your key message?`}
                    className="min-w-0 flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => void saveEdit()}
                    disabled={saving}
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={cancelEdit}
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="group flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                    {value || (
                      <span className="italic">e.g. What is your key message?</span>
                    )}
                  </p>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => startEdit(index)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
