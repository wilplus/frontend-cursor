"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuthReady } from "@/hooks/useAuthReady";
import { fetchUserRecordings, fetchRecording } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import type { GetRecordingResponse } from "@/lib/api/types";

const CHART_LIMIT = 21;
const PADDING = { top: 12, right: 12, bottom: 44, left: 36 };

type DataPoint = { id: string; created_at: string; score: number };

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const n = points.length;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function KPILineChart() {
  const authReady = useAuthReady();
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchUserRecordings(CHART_LIMIT, 0);
      const items = res?.items || [];
      const withScores: DataPoint[] = [];
      for (const item of items) {
        try {
          const detail: GetRecordingResponse = await fetchRecording(item.id);
          const kpi = detail.performance_score?.final_kpi;
          if (kpi != null && typeof kpi === "number") {
            withScores.push({
              id: item.id,
              created_at: item.created_at,
              score: Math.round(kpi * 100),
            });
          }
        } catch {
          // skip recordings without score or failed fetch
        }
      }
      withScores.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setData(withScores);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) load();
  }, [authReady, load]);

  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance over time</h3>
        <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </Card>
    );
  }

  if (data.length < 1) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance over time</h3>
        <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
          Complete more sessions to see your performance trend.
        </div>
      </Card>
    );
  }

  const width = 400;
  const height = 160;
  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;
  const minScore = 0;
  const maxScore = 100;
  const scoreRange = maxScore - minScore;
  const xScale = (i: number) => PADDING.left + (i / Math.max(1, data.length - 1)) * innerWidth;
  const yScale = (score: number) =>
    PADDING.top + innerHeight - ((Math.max(0, Math.min(100, score)) - minScore) / scoreRange) * innerHeight;

  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.score) }));
  const pathD = smoothPath(points);

  // X-axis date tick indices (first, ~1/3, ~2/3, last)
  const n = data.length;
  const dateTickIndices =
    n <= 4
      ? data.map((_, i) => i)
      : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].filter((v, i, a) => a.indexOf(v) === i);

  const hoveredPoint = hoveredIndex != null ? data[hoveredIndex] : null;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Performance over time</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Performance score % by session (oldest → newest). Hover a dot for details.
      </p>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[180px]"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Y axis labels */}
          {[0, 25, 50, 75, 100].map((s) => {
            const y = yScale(s);
            return (
              <text
                key={s}
                x={PADDING.left - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {s}%
              </text>
            );
          })}
          {/* X axis date labels */}
          {dateTickIndices.map((i) => {
            const x = xScale(i);
            const label = format(new Date(data[i].created_at), "MMM d");
            return (
              <text
                key={i}
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {label}
              </text>
            );
          })}
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((s) => (
            <line
              key={s}
              x1={PADDING.left}
              y1={yScale(s)}
              x2={width - PADDING.right}
              y2={yScale(s)}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeDasharray="2 2"
            />
          ))}
          {/* Smooth line */}
          <path
            d={pathD}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Orange dot per recording */}
          {points.map((pt, i) => (
            <circle
              key={data[i].id}
              cx={pt.x}
              cy={pt.y}
              r={6}
              className="fill-orange-500 stroke-white dark:stroke-background cursor-pointer"
              strokeWidth={2}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>
        {/* Hover tooltip area below chart */}
        {hoveredPoint && (
          <div className="mt-3 p-3 rounded-lg bg-muted/80 border text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium">Score: {hoveredPoint.score}%</span>
              <span className="text-muted-foreground">
                {format(new Date(hoveredPoint.created_at), "MMM d, yyyy")}
              </span>
              <Link
                href={`/recordings/${hoveredPoint.id}`}
                className="text-orange-500 hover:underline font-medium"
              >
                Go to recording →
              </Link>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
