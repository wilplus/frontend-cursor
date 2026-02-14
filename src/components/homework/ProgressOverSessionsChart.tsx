"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";

const ORANGE = "#f97316";

export interface ProgressOverSessionsChartPoint {
  sessionLabel: string;
  date: string;
  score: number;
}

export interface ProgressOverSessionsChartProps {
  data: ProgressOverSessionsChartPoint[];
}

function formatDate(isoOrDate: string): string {
  try {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoOrDate;
  }
}

export default function ProgressOverSessionsChart({ data }: ProgressOverSessionsChartProps) {
  if (data.length === 0) return null;

  return (
    <Card className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="mb-4 text-base font-bold text-foreground">Progress over sessions</p>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="hsl(var(--muted-foreground) / 0.3)"
              vertical={false}
            />
            <XAxis
              dataKey="sessionLabel"
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={36}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as ProgressOverSessionsChartPoint;
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
                    <p className="text-xs font-medium text-muted-foreground">{p.sessionLabel}</p>
                    <p className="mt-0.5 text-sm text-foreground">
                      {formatDate(p.date)}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: ORANGE }}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        Overall score: {p.score}
                      </span>
                    </div>
                  </div>
                );
              }}
              cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "2 2" }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={ORANGE}
              strokeWidth={2}
              dot={{ fill: ORANGE, strokeWidth: 0, r: 5 }}
              activeDot={{ r: 7, stroke: "hsl(var(--background))", strokeWidth: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
