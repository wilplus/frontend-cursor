"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Card } from "@/components/ui/card";

const ORANGE = "#f97316";
const MUTED = "hsl(var(--muted-foreground))";

export interface ReportSessionScores {
  warmup?: number;
  final?: number;
  overall: number;
}

/** `warmup` key matches API scores shape; label is student-facing. */
const LABELS = { warmup: "First task", final: "Final", overall: "Overall" };

export default function ReportSessionChart({ scores }: { scores: ReportSessionScores }) {
  const data = [
    { key: "warmup", label: LABELS.warmup, value: scores.warmup },
    { key: "final", label: LABELS.final, value: scores.final },
    { key: "overall", label: LABELS.overall, value: scores.overall },
  ].filter((d) => typeof d.value === "number");

  if (data.length === 0) return null;

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-medium text-foreground">Performance scores</p>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
            layout="vertical"
          >
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {data.map((_, i) => (
                <Cell key={data[i].key} fill={i === 2 ? ORANGE : "hsl(var(--primary))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
