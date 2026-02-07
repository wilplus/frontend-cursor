"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export interface MetricsSectionProps {
  metric_question_1: string;
  metric_question_2: string;
  metric_question_3: string;
  onSave: (data: {
    metric_question_1: string;
    metric_question_2: string;
    metric_question_3: string;
  }) => void | Promise<void>;
  saving?: boolean;
}

const PLACEHOLDERS = [
  "What is the 1 thing you want your audience to understand?",
  "What is the main emotion you want them to feel during your talk?",
  "What is your key message?",
];

export default function MetricsSection({
  metric_question_1: initial1,
  metric_question_2: initial2,
  metric_question_3: initial3,
  onSave,
  saving = false,
}: MetricsSectionProps) {
  const [q1, setQ1] = useState(initial1);
  const [q2, setQ2] = useState(initial2);
  const [q3, setQ3] = useState(initial3);

  useEffect(() => {
    setQ1(initial1);
    setQ2(initial2);
    setQ3(initial3);
  }, [initial1, initial2, initial3]);

  const values = [q1, q2, q3];
  const setters = [setQ1, setQ2, setQ3];

  const handleBlur = (index: 0 | 1 | 2) => {
    const next = [...values];
    const payload = {
      metric_question_1: next[0] ?? "",
      metric_question_2: next[1] ?? "",
      metric_question_3: next[2] ?? "",
    };
    void onSave(payload);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Metrics</p>
      <ul className="space-y-2">
        {([0, 1, 2] as const).map((index) => (
          <li key={index} className="rounded-md bg-muted/50 px-3 py-2">
            <Input
              value={values[index]}
              onChange={(e) => setters[index](e.target.value)}
              onBlur={() => handleBlur(index)}
              placeholder={PLACEHOLDERS[index]}
              disabled={saving}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
