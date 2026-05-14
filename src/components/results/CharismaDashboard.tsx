"use client";

/**
 * Charisma Awareness Dashboard.
 *
 * Sits ABOVE the per-snippet `<SnippetCard>` list on the user-facing
 * /results/[sessionId] page and gives the user a one-glance read of
 * the SESSION as a whole — not snippet-by-snippet — across four
 * dimensions:
 *
 *   1. Archetype + AI narrative      (hero)
 *   2. Acoustic Activation Zone      (pace timeline + ideal band)
 *   3. Charisma Trinity Balance      (Power / Warmth / Presence)
 *   4. Stress Trigger Signature      (heatmap of stress moments)
 *   5. Recommendation                (next-step CTA into the chat)
 *
 * Design notes:
 *   - Lives inside a pure-white, light-mode bubble (CSS tokens
 *     scoped via `--dash-*` in globals.css). The rest of the page
 *     uses a warm off-white palette; this section deliberately
 *     resets to white so the data viz reads cleanly.
 *   - There's NO H1 — we already passed the page header upstream.
 *     The archetype pill IS the visual anchor.
 *   - Animations stagger by `60ms + index * 100ms` per spec.
 *   - When `profile` is null/undefined the entire dashboard renders
 *     as a skeleton (same card shapes, no data) so layout doesn't
 *     pop in late.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* -------------------------------------------------------------------------- */
/*  Public data contract                                                      */
/*  Mirrors the BFF payload field `charisma_profile`. Optional everywhere     */
/*  so the dashboard can degrade gracefully into its skeleton state.          */
/* -------------------------------------------------------------------------- */

export interface CharismaProfile {
  /** Short snappy archetype label, e.g. "The Visionary Leader". */
  archetype: string;
  /** AI-written 2-4 sentence narrative — the same `session_kpi_narrative`
   *  the admin sees in the Performance summary card. */
  narrative: string;
  acoustics: {
    /** Avg WPM across the session. */
    pace: number;
    /** Inclusive lower bound of the spoken-ideal pace band. */
    idealMin: number;
    /** Inclusive upper bound of the spoken-ideal pace band. */
    idealMax: number;
    /** Topic on which the user spoke most fluidly. Free-text. */
    peakTopic: string;
    /** Per-turn / per-window pace samples for the bar chart. */
    timeline: { t: string; wpm: number }[];
  };
  trinity: {
    /** Each metric is a 0..1 fraction. Barycentric position is
     *  computed locally from these three. */
    power: number;
    warmth: number;
    presence: number;
    /** AI-written single-sentence read of the balance. */
    insight: string;
  };
  triggers: {
    /** Top stress theme, e.g. "Conflict avoidance". */
    topTheme: string;
    /** Pre-formatted pitch delta string, e.g. "+3.2 st". */
    pitchDelta: string;
    /** Pre-formatted filler multiplier, e.g. "2.4x". */
    fillerMultiplier: string;
    /** Trigger moments. `t` is a 0..100 % position along the
     *  session timeline, `intensity` is 0..1. */
    points: { t: number; intensity: number }[];
  };
  recommendation: {
    title: string;
    body: string;
  };
}

/* -------------------------------------------------------------------------- */
/*  Top-level component                                                       */
/* -------------------------------------------------------------------------- */

interface CharismaDashboardProps {
  profile: CharismaProfile | null | undefined;
}

export default function CharismaDashboard({ profile }: CharismaDashboardProps) {
  // Null-safe: render the skeleton with the same shape so the page
  // layout doesn't shift when the real payload arrives.
  if (!profile) {
    return <CharismaDashboardSkeleton />;
  }

  return (
    <section
      // White-on-white surface for the dashboard. The rest of the
      // page is warm off-white; this island deliberately resets to
      // pure white so the chart axes / heatmap reads cleanly.
      className="relative mb-12 overflow-hidden rounded-3xl bg-[hsl(var(--dash-bg))] text-[hsl(var(--dash-foreground))]"
      aria-label="Charisma awareness dashboard"
    >
      {/* Ambient brand-glow wash from the top, decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-glow)] opacity-50"
      />

      <div className="relative mx-auto max-w-6xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <HeroBlock
          archetype={profile.archetype}
          narrative={profile.narrative}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard
            eyebrow="Acoustic activation zone"
            title="When you found your flow"
            indexForStagger={1}
          >
            <AcousticActivationZone acoustics={profile.acoustics} />
          </SectionCard>

          <SectionCard
            eyebrow="Charisma trinity"
            title="Your power · warmth · presence balance"
            indexForStagger={2}
          >
            <TrinityBalance trinity={profile.trinity} />
          </SectionCard>
        </div>

        <SectionCard
          eyebrow="Stress trigger signature"
          title="Where you tightened up"
          indexForStagger={3}
        >
          <StressTriggerHeatmap triggers={profile.triggers} />
        </SectionCard>

        <RecommendationCTA recommendation={profile.recommendation} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — Archetype pill + AI narrative                                      */
/* -------------------------------------------------------------------------- */

function HeroBlock({
  archetype,
  narrative,
}: {
  archetype: string;
  narrative: string;
}) {
  return (
    <div
      className="animate-fade-in-up space-y-5"
      style={{ animationDelay: "60ms" }}
    >
      {/* Archetype pill — orange-ringed, pulsing dot signals "live"
          (i.e. computed from this session). */}
      <div className="flex items-center justify-center">
        <span
          className="dash-glow-ring inline-flex items-center gap-2.5 rounded-full bg-[hsl(var(--dash-bg))] px-4 py-2 text-sm font-semibold tracking-wide text-[hsl(var(--dash-foreground))]"
          aria-label={`Charisma archetype: ${archetype}`}
        >
          <span
            aria-hidden
            className="dash-pulse-dot inline-block h-2 w-2 rounded-full bg-[hsl(var(--dash-brand))]"
          />
          {archetype}
        </span>
      </div>

      {/* Narrative blockquote — italic serif, brand-orange left rule.
          NOT an h1 per spec. Centered on wide screens so the pill +
          quote pair reads as a single hero block. */}
      <blockquote
        className="mx-auto max-w-3xl border-l-2 border-[hsl(var(--dash-brand))] pl-5 font-heading text-lg italic leading-relaxed text-[hsl(var(--dash-foreground))] md:text-xl"
      >
        {narrative}
      </blockquote>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reusable section card                                                     */
/* -------------------------------------------------------------------------- */

function SectionCard({
  eyebrow,
  title,
  indexForStagger,
  children,
}: {
  eyebrow: string;
  title: string;
  /** 1-indexed; entrance delay = 60ms + index * 100ms per spec. */
  indexForStagger: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="dash-glass animate-fade-in-up rounded-2xl p-5 md:p-6"
      style={{ animationDelay: `${60 + indexForStagger * 100}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--dash-muted))]">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-base font-semibold text-[hsl(var(--dash-foreground))] md:text-lg">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section 1 — Acoustic Activation Zone                                      */
/* -------------------------------------------------------------------------- */

function AcousticActivationZone({
  acoustics,
}: {
  acoustics: CharismaProfile["acoustics"];
}) {
  const inZone =
    acoustics.pace >= acoustics.idealMin &&
    acoustics.pace <= acoustics.idealMax;

  const data = acoustics.timeline.map((p) => ({
    t: p.t,
    wpm: Math.max(0, Math.round(p.wpm)),
  }));

  // Y-axis padding: at least ±20 WPM around the ideal band so the
  // green strip never hugs an edge of the chart.
  const allValues = [...data.map((d) => d.wpm), acoustics.idealMin, acoustics.idealMax];
  const yMin = Math.max(0, Math.min(...allValues) - 20);
  const yMax = Math.max(...allValues) + 20;

  return (
    <div className="space-y-4">
      {/* Headline numbers row — pace + zone status + peak topic. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--dash-muted))]">
            Avg pace
          </p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums text-[hsl(var(--dash-foreground))]">
            {Math.round(acoustics.pace)}
            <span className="ml-1 text-sm font-normal text-[hsl(var(--dash-muted))]">
              wpm
            </span>
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              inZone
                ? "bg-[hsl(var(--dash-success)/0.12)] text-[hsl(var(--dash-success))]"
                : "bg-[hsl(var(--dash-danger)/0.1)] text-[hsl(var(--dash-danger))]"
            }`}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-current"
            />
            {inZone ? "In ideal zone" : "Outside ideal zone"}
          </span>
          <p className="mt-1 text-[11px] text-[hsl(var(--dash-muted))]">
            Ideal {acoustics.idealMin}–{acoustics.idealMax} wpm
          </p>
        </div>
      </div>

      {/* Recharts BarChart — pace per turn with a translucent green
          ReferenceArea marking the ideal speaking band. */}
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 6, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--dash-border))"
              strokeDasharray="2 4"
            />
            <XAxis
              dataKey="t"
              stroke="hsl(var(--dash-muted))"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--dash-border))" }}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke="hsl(var(--dash-muted))"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--dash-border))" }}
              width={36}
            />
            <ReferenceArea
              y1={acoustics.idealMin}
              y2={acoustics.idealMax}
              fill="hsl(var(--dash-success))"
              fillOpacity={0.12}
              stroke="hsl(var(--dash-success))"
              strokeOpacity={0.25}
              strokeDasharray="3 4"
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--dash-surface-2))" }}
              contentStyle={{
                background: "hsl(var(--dash-bg))",
                border: "1px solid hsl(var(--dash-border))",
                borderRadius: 12,
                fontSize: 12,
                color: "hsl(var(--dash-foreground))",
              }}
              labelStyle={{ color: "hsl(var(--dash-muted))" }}
              formatter={(value) => [
                // Recharts widens the value type to `number | undefined` —
                // coerce to integer wpm so the tooltip never reads "NaN wpm".
                `${typeof value === "number" ? Math.round(value) : "—"} wpm`,
                "Pace",
              ]}
            />
            <Bar
              dataKey="wpm"
              radius={[6, 6, 0, 0]}
              fill="hsl(var(--dash-brand))"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Peak topic callout. */}
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        You hit your stride on{" "}
        <span className="font-semibold text-[hsl(var(--dash-foreground))]">
          {acoustics.peakTopic}
        </span>
        .
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section 2 — Charisma Trinity Balance                                      */
/*  Pure SVG equilateral triangle. The dot's barycentric weight is the        */
/*  user's normalized (power, warmth, presence) — the closer to a vertex,    */
/*  the more dominant that trait.                                             */
/* -------------------------------------------------------------------------- */

function TrinityBalance({
  trinity,
}: {
  trinity: CharismaProfile["trinity"];
}) {
  const total = trinity.power + trinity.warmth + trinity.presence;
  const safeTotal = total > 0 ? total : 1;
  const w = {
    p: trinity.power / safeTotal,
    wa: trinity.warmth / safeTotal,
    pr: trinity.presence / safeTotal,
  };

  // Triangle geometry: equilateral, vertex coordinates inside a 200x180
  // viewBox. Power = top, Warmth = bottom-left, Presence = bottom-right.
  const VB_W = 200;
  const VB_H = 180;
  const margin = 22;
  const top = { x: VB_W / 2, y: margin };
  const bl = { x: margin, y: VB_H - margin };
  const br = { x: VB_W - margin, y: VB_H - margin };

  // Barycentric → cartesian.
  const dot = {
    x: w.p * top.x + w.wa * bl.x + w.pr * br.x,
    y: w.p * top.y + w.wa * bl.y + w.pr * br.y,
  };

  return (
    <div className="grid gap-5 md:grid-cols-[180px_1fr] md:items-center">
      {/* SVG triangle */}
      <div className="mx-auto w-full max-w-[180px]">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Trinity balance: power ${(w.p * 100).toFixed(0)}%, warmth ${(w.wa * 100).toFixed(0)}%, presence ${(w.pr * 100).toFixed(0)}%`}
        >
          {/* Faint inner grid for visual anchoring */}
          <polygon
            points={`${(top.x + bl.x) / 2},${(top.y + bl.y) / 2} ${(top.x + br.x) / 2},${(top.y + br.y) / 2} ${(bl.x + br.x) / 2},${(bl.y + br.y) / 2}`}
            fill="hsl(var(--dash-brand) / 0.05)"
            stroke="hsl(var(--dash-border))"
            strokeWidth={0.6}
          />
          {/* Outer triangle */}
          <polygon
            points={`${top.x},${top.y} ${bl.x},${bl.y} ${br.x},${br.y}`}
            fill="hsl(var(--dash-brand) / 0.04)"
            stroke="hsl(var(--dash-foreground) / 0.6)"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {/* Vertex labels */}
          <text
            x={top.x}
            y={top.y - 6}
            textAnchor="middle"
            fontSize={9}
            fontWeight={600}
            fill="hsl(var(--dash-muted))"
            style={{ letterSpacing: "0.12em" }}
          >
            POWER
          </text>
          <text
            x={bl.x - 2}
            y={bl.y + 11}
            textAnchor="start"
            fontSize={9}
            fontWeight={600}
            fill="hsl(var(--dash-muted))"
            style={{ letterSpacing: "0.12em" }}
          >
            WARMTH
          </text>
          <text
            x={br.x + 2}
            y={br.y + 11}
            textAnchor="end"
            fontSize={9}
            fontWeight={600}
            fill="hsl(var(--dash-muted))"
            style={{ letterSpacing: "0.12em" }}
          >
            PRESENCE
          </text>
          {/* Soft halo around the dot */}
          <circle
            cx={dot.x}
            cy={dot.y}
            r={9}
            fill="hsl(var(--dash-brand) / 0.18)"
          />
          {/* The dot itself */}
          <circle
            cx={dot.x}
            cy={dot.y}
            r={4.5}
            fill="hsl(var(--dash-brand))"
            stroke="hsl(var(--dash-bg))"
            strokeWidth={1.5}
          />
        </svg>
      </div>

      {/* 3 animated bars */}
      <div className="space-y-3">
        <TrinityBar label="Power" value={trinity.power} delayMs={120} />
        <TrinityBar label="Warmth" value={trinity.warmth} delayMs={200} />
        <TrinityBar label="Presence" value={trinity.presence} delayMs={280} />
        <p className="pt-1 text-xs leading-relaxed text-[hsl(var(--dash-muted))]">
          {trinity.insight}
        </p>
      </div>
    </div>
  );
}

function TrinityBar({
  label,
  value,
  delayMs,
}: {
  label: string;
  value: number;
  delayMs: number;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
          {label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-[hsl(var(--dash-foreground))]">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--dash-surface-2))]">
        <div
          className="dash-bar-grow h-full rounded-full bg-[image:var(--gradient-brand)]"
          style={{
            width: `${pct * 100}%`,
            animationDelay: `${delayMs}ms`,
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section 3 — Stress Trigger Heatmap                                        */
/*  Pure CSS/divs, no canvas. Container is a horizontal danger-band; trigger  */
/*  points are absolutely-positioned radial gradients.                        */
/* -------------------------------------------------------------------------- */

function StressTriggerHeatmap({
  triggers,
}: {
  triggers: CharismaProfile["triggers"];
}) {
  const points = (triggers.points ?? [])
    .map((p) => ({
      t: Math.max(0, Math.min(100, p.t)),
      intensity: Math.max(0, Math.min(1, p.intensity)),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.intensity));

  return (
    <div className="space-y-4">
      {/* Mini stat row above the heatmap */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <HeatmapStat label="Top theme" value={triggers.topTheme} />
        <HeatmapStat label="Pitch delta" value={triggers.pitchDelta} />
        <HeatmapStat label="Filler ×" value={triggers.fillerMultiplier} />
      </div>

      {/* Heatmap surface */}
      <div className="relative h-28 overflow-hidden rounded-xl border border-[hsl(var(--dash-border))]">
        {/* Subtle base gradient: cool on the left, warming as the
            session approaches the more pressured later turns. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--dash-surface)) 0%, hsl(var(--dash-danger) / 0.06) 100%)",
          }}
        />
        {/* Trigger points */}
        {points.map((p, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${p.t}%`,
              width: 96,
              height: 96,
              background: `radial-gradient(circle, hsl(var(--dash-danger) / ${0.18 + p.intensity * 0.55}) 0%, transparent 65%)`,
            }}
          />
        ))}
        {/* Timeline tick labels */}
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-between px-2 text-[10px] text-[hsl(var(--dash-muted))]">
          <span>Start</span>
          <span>Mid</span>
          <span>End</span>
        </div>

        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[hsl(var(--dash-muted))]">
            No stress triggers detected this session.
          </div>
        )}
      </div>
    </div>
  );
}

function HeatmapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-[hsl(var(--dash-foreground))]">
        {value}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section 4 — Recommendation CTA                                            */
/*  Full-width card with brand gradient button. Anchors the user into the     */
/*  next coaching loop — most natural fit is the chat with no source snippet  */
/*  (general practice). Backend can swap this for a deep link later.          */
/* -------------------------------------------------------------------------- */

function RecommendationCTA({
  recommendation,
}: {
  recommendation: CharismaProfile["recommendation"];
}) {
  return (
    <div
      className="dash-glass animate-fade-in-up flex flex-col items-start justify-between gap-4 rounded-2xl p-5 md:flex-row md:items-center md:p-6"
      style={{ animationDelay: "460ms" }}
    >
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--dash-brand))]">
          Your next move
        </p>
        <h3 className="text-base font-semibold text-[hsl(var(--dash-foreground))] md:text-lg">
          {recommendation.title}
        </h3>
        <p className="max-w-2xl text-sm leading-relaxed text-[hsl(var(--dash-muted))]">
          {recommendation.body}
        </p>
      </div>
      <a
        href="/chat"
        className="inline-flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-[1px]"
        style={{
          background: "var(--gradient-brand)",
          boxShadow: "var(--shadow-glow)",
        }}
      >
        Start practice session
        <svg
          aria-hidden
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton — placeholder shapes shown while `profile` is null/loading       */
/* -------------------------------------------------------------------------- */

function CharismaDashboardSkeleton() {
  return (
    <section
      className="relative mb-12 overflow-hidden rounded-3xl bg-[hsl(var(--dash-bg))]"
      aria-busy
      aria-label="Charisma dashboard loading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-glow)] opacity-50"
      />
      <div className="relative mx-auto max-w-6xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        {/* Hero skeleton */}
        <div className="flex flex-col items-center gap-4">
          <div className="h-9 w-52 animate-pulse rounded-full bg-[hsl(var(--dash-surface-2))]" />
          <div className="h-20 w-full max-w-3xl animate-pulse rounded-md bg-[hsl(var(--dash-surface-2))]" />
        </div>

        {/* 2-col card skeletons */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="dash-glass h-64 animate-pulse rounded-2xl" />
          <div className="dash-glass h-64 animate-pulse rounded-2xl" />
        </div>

        {/* Heatmap skeleton */}
        <div className="dash-glass h-44 animate-pulse rounded-2xl" />

        {/* CTA skeleton */}
        <div className="dash-glass h-24 animate-pulse rounded-2xl" />
      </div>
    </section>
  );
}
