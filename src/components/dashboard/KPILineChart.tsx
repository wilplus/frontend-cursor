"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

type TooltipAnchor = { left: number; top: number; bottom: number };

export type ChartDataPoint = {
  id: string;
  created_at: string;
  performance_score: number;
};

/** Fetch list only (fast). Used to show chart shell immediately. */
async function fetchChartList(): Promise<{ id: string; created_at: string }[]> {
  const res = await fetchUserRecordings(CHART_LIMIT, 0);
  const items = res?.items ?? [];
  return [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Fetch scores for list items in parallel. Run after chart is visible. */
async function fetchChartScores(
  items: { id: string; created_at: string }[]
): Promise<ChartDataPoint[]> {
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
  return details.filter((d): d is ChartDataPoint => d != null);
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  hoveredIndex: number | null;
  onMouseEnter: (index: number, e: React.MouseEvent<SVGGElement>) => void;
  onMouseLeave: () => void;
}) {
  const { cx = 0, cy = 0, index = 0, hoveredIndex, onMouseEnter, onMouseLeave } = props;
  const isActive = hoveredIndex === index;
  const r = isActive ? 8 : 6;

  return (
    <g
      onMouseEnter={(e) => onMouseEnter(index, e)}
      onMouseLeave={onMouseLeave}
      style={{ cursor: "pointer" }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={ORANGE}
        stroke="white"
        strokeWidth={3}
      />
    </g>
  );
}

function TooltipPopover({
  point,
  anchor,
  onMouseEnter,
  onMouseLeave,
}: {
  point: ChartDataPoint;
  anchor: TooltipAnchor;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className="pointer-events-auto fixed z-50 rounded-lg border bg-white/90 p-3 text-sm shadow-lg backdrop-blur-md dark:bg-gray-900/90"
      style={{
        left: Math.min(anchor.left, typeof window !== "undefined" ? window.innerWidth - 220 : anchor.left),
        top: anchor.bottom + 6,
      }}
      role="tooltip"
      aria-label="Recording details"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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

const HOVER_HIDE_DELAY_MS = 120;

export default function KPILineChart() {
  const authReady = useAuthReady();
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScores, setLoadingScores] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<TooltipAnchor | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const items = await fetchChartList();
      if (items.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }
      const placeholder: ChartDataPoint[] = items.map((i) => ({
        id: i.id,
        created_at: i.created_at,
        performance_score: 0,
      }));
      setData(placeholder);
      setLoading(false);
      setLoadingScores(true);
      const withScores = await fetchChartScores(items);
      setData(withScores);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
      setLoadingScores(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) load();
  }, [authReady, load]);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredIndex(null);
      setTooltipAnchor(null);
      hideTimeoutRef.current = null;
    }, HOVER_HIDE_DELAY_MS);
  }, [clearHideTimeout]);

  const handleDotMouseEnter = useCallback(
    (index: number, e: React.MouseEvent<SVGGElement>) => {
      clearHideTimeout();
      const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
      setTooltipAnchor({ left: rect.left, top: rect.top, bottom: rect.bottom });
      setHoveredIndex(index);
    },
    [clearHideTimeout]
  );

  const handleDotMouseLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  const handleTooltipMouseEnter = useCallback(() => {
    clearHideTimeout();
  }, [clearHideTimeout]);

  const handleTooltipMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    setTooltipAnchor(null);
  }, []);

  useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  const hoveredPoint = hoveredIndex != null ? data[hoveredIndex] ?? null : null;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-orange-500" aria-hidden />
          <h3 className="text-lg font-semibold">Performance Trend</h3>
        </div>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-md bg-muted/30 py-12"
          style={{ height: 280 }}
          aria-label="Loading chart"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading performance trend…</p>
        </div>
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
        {loadingScores && (
          <div className="absolute left-0 right-0 top-2 z-10 flex justify-center">
            <span className="rounded bg-muted/90 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              Loading scores…
            </span>
          </div>
        )}
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
                    hoveredIndex={hoveredIndex}
                    onMouseEnter={handleDotMouseEnter}
                    onMouseLeave={handleDotMouseLeave}
                  />
                );
              }}
              activeDot={false}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* Hover tooltip next to dot - show when hovering dot or tooltip, hide when mouse leaves both */}
        {hoveredPoint && tooltipAnchor && (
          <TooltipPopover
            point={hoveredPoint}
            anchor={tooltipAnchor}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
          />
        )}
      </div>
    </Card>
  );
}
