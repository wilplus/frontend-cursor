"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useAuthReady } from "@/hooks/useAuthReady";
import { fetchUserRecordings, fetchRecording } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";

const CHART_LIMIT = 7;
const ORANGE = "#f97316"; // tailwind orange-500

export type ChartDataPoint = {
  id: string;
  created_at: string;
  performance_score: number;
};

function loadChartData(): Promise<ChartDataPoint[]> {
  return fetchUserRecordings(CHART_LIMIT, 0).then(async (res) => {
    const items = res?.items ?? [];
    const details = await Promise.all(
      items.map((item) =>
        fetchRecording(item.id).then(
          (detail) => {
            const kpi = detail?.performance_score?.final_kpi;
            if (kpi != null && typeof kpi === "number") {
              return {
                id: item.id,
                created_at: item.created_at,
                performance_score: Math.round(kpi * 100),
              } as ChartDataPoint;
            }
            return null;
          },
          () => null
        )
      )
    );
    const withScores = details.filter((d): d is ChartDataPoint => d != null);
    withScores.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return withScores;
  });
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const {
    cx = 0,
    cy = 0,
    index = 0,
    selectedIndex,
    hoveredIndex,
    onMouseEnter,
    onMouseLeave,
    onClick,
  } = props;
  const isActive = selectedIndex === index || hoveredIndex === index;
  const r = isActive ? 8 : 6;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={ORANGE}
      stroke="white"
      strokeWidth={3}
      className="cursor-pointer"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
}

function CustomTooltipContent({
  point,
  onClose,
}: {
  point: ChartDataPoint | null;
  onClose: () => void;
}) {
  if (!point) return null;
  return (
    <div
      className="rounded-lg border bg-white/80 p-3 text-sm shadow-lg backdrop-blur-md dark:bg-gray-900/80"
      role="dialog"
      aria-label="Recording details"
    >
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-foreground">{point.performance_score}%</span>
        <span className="text-muted-foreground">
          {format(new Date(point.created_at), "MMMM d, yyyy")}
        </span>
        <Link
          href={`/recordings/${point.id}`}
          className="mt-1 font-medium text-orange-500 hover:underline"
        >
          Go to recording →
        </Link>
      </div>
    </div>
  );
}

export default function KPILineChart() {
  const authReady = useAuthReady();
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await loadChartData();
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) load();
  }, [authReady, load]);

  const selectedPoint = selectedIndex != null ? data[selectedIndex] ?? null : null;

  const handleDotClick = (index: number) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-orange-500" aria-hidden />
          <h3 className="text-lg font-semibold">Performance Trend</h3>
        </div>
        <div
          className="animate-pulse rounded-md bg-muted/50"
          style={{ height: 280 }}
          aria-label="Loading chart"
        />
      </Card>
    );
  }

  if (data.length < 1) {
    return (
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-orange-500" aria-hidden />
          <h3 className="text-lg font-semibold">Performance Trend</h3>
        </div>
        <div
          className="flex flex-col items-center justify-center gap-3 text-muted-foreground"
          style={{ height: 280 }}
        >
          <TrendingUp className="h-12 w-12 opacity-40" aria-hidden />
          <p className="text-sm">Complete more sessions to see your performance trend.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-orange-500" aria-hidden />
        <h3 className="text-lg font-semibold">Performance Trend</h3>
      </div>
      <div className="relative" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, bottom: 24, left: 8 }}
          >
            <defs>
              <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ORANGE} stopOpacity={0.3} />
                <stop offset="100%" stopColor={ORANGE} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 2"
              stroke="currentColor"
              strokeOpacity={0.08}
              vertical={false}
            />
            <XAxis
              dataKey="created_at"
              tickFormatter={(value) => format(new Date(value), "MMM d")}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickCount={4}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              width={28}
            />
            <Area
              type="monotone"
              dataKey="performance_score"
              stroke={ORANGE}
              strokeWidth={2.5}
              fill="url(#orangeGradient)"
              dot={(dotProps) => {
                const payload = dotProps.payload as ChartDataPoint | undefined;
                const index =
                  payload != null
                    ? data.findIndex((d) => d.id === payload.id)
                    : -1;
                const i = index >= 0 ? index : 0;
                return (
                  <CustomDot
                    cx={dotProps.cx}
                    cy={dotProps.cy}
                    index={i}
                    selectedIndex={selectedIndex}
                    hoveredIndex={hoveredIndex}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => handleDotClick(i)}
                  />
                );
              }}
              activeDot={false}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* Click-to-show tooltip panel (frosted glass) - shown below chart when a dot is selected */}
        {selectedPoint && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pt-2">
            <CustomTooltipContent
              point={selectedPoint}
              onClose={() => setSelectedIndex(null)}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
