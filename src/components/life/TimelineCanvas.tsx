"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LIFE_BETS, type LifeTimelineEvent } from "@/lib/life/types";
import {
  clampScale,
  MS_PER_DAY,
  tickLabel,
  ticksFor,
  tierForScale,
  timeToX,
  windowFor,
  xToTime,
} from "@/lib/life/timelineScale";

/* -------------------------------------------------------------------------- */
/*  FE-8 — the timeline, ported and re-skinned                                 */
/*                                                                            */
/*  The MECHANICS are the ones from the standalone timeline app: drag to pan,  */
/*  scroll or pinch to zoom, tap a marker for detail, hide a category. The     */
/*  STYLING is the app's, not the original's, because unlike prayer this one   */
/*  lives inside the product.                                                  */
/*                                                                            */
/*  Note for the port: the original single-file renderer was not available in  */
/*  this repo (it lives on the founder's machine), so the canvas here is       */
/*  written from its described behaviour rather than copied. If the original   */
/*  has interaction details worth keeping, diff against it before ship.        */
/*                                                                            */
/*  Three tiers because 60 years is 240 quarters and they cannot all render at */
/*  once. The tier follows the scale; it is not a control the user sets.       */
/*                                                                            */
/*  Bets are colour BANDS, goals are MARKERS, and the colours are the three    */
/*  the rest of the panel already uses (🟢🔵🟣), which is also what the        */
/*  original's categoryColor field held.                                       */
/* -------------------------------------------------------------------------- */

const LANE_TOP = 56;
const LANE_HEIGHT = 64;
const MARKER_RADIUS = 5;

export default function TimelineCanvas({
  events,
}: {
  events: LifeTimelineEvent[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [centerMs, setCenterMs] = useState(() => Date.now());
  const [pxPerDay, setPxPerDay] = useState(() => clampScale(1200 / (10 * 365)));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<LifeTimelineEvent | null>(null);

  // Pointer bookkeeping for drag-to-pan and two-finger pinch.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{ x: number; center: number; moved: boolean } | null>(
    null
  );
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  /* ------------------------------ measuring ------------------------------- */

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------- drawing -------------------------------- */

  // Memoised so `draw` keeps a stable identity: a fresh array every render
  // would re-run the draw effect on every render, including the ones a pointer
  // move already triggers.
  const visible = useMemo(
    () => events.filter((e) => !e.betKey || !hidden.has(e.betKey)),
    [events, hidden]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    const tier = tierForScale(pxPerDay);
    const { fromMs, toMs } = windowFor(centerMs, pxPerDay, size.width);
    const style = getComputedStyle(document.documentElement);
    const ink = `hsl(${style.getPropertyValue("--foreground").trim() || "0 0% 7%"})`;
    const faint = `hsl(${style.getPropertyValue("--border").trim() || "0 0% 92%"})`;
    const muted = `hsl(${style.getPropertyValue("--muted-foreground").trim() || "0 0% 45%"})`;

    // Gridlines and tick labels for the current tier.
    ctx.font =
      "11px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    ctx.textBaseline = "top";
    for (const t of ticksFor(tier, fromMs, toMs)) {
      const x = Math.round(timeToX(t, centerMs, pxPerDay, size.width)) + 0.5;
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 28);
      ctx.lineTo(x, size.height);
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.fillText(tickLabel(tier, t), x + 4, 10);
    }

    // Today.
    const todayX = timeToX(Date.now(), centerMs, pxPerDay, size.width);
    if (todayX >= 0 && todayX <= size.width) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(Math.round(todayX) + 0.5, 28);
      ctx.lineTo(Math.round(todayX) + 0.5, size.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // One lane per bet, in rank order. Bands first, markers on top.
    LIFE_BETS.forEach((bet, laneIndex) => {
      if (hidden.has(bet.key)) return;
      const laneY = LANE_TOP + laneIndex * LANE_HEIGHT;
      const laneEvents = visible.filter((e) => e.betKey === bet.key);
      if (laneEvents.length === 0) return;

      const band = laneEvents.filter((e) => e.kind === "bet");
      for (const b of band) {
        const x1 = timeToX(new Date(b.at).getTime(), centerMs, pxPerDay, size.width);
        const endMs = b.endAt ? new Date(b.endAt).getTime() : NaN;
        const x2 = Number.isNaN(endMs)
          ? x1 + 24
          : timeToX(endMs, centerMs, pxPerDay, size.width);
        ctx.fillStyle = `${bet.color}22`;
        ctx.fillRect(x1, laneY, Math.max(2, x2 - x1), LANE_HEIGHT - 18);
      }

      ctx.fillStyle = muted;
      ctx.fillText(bet.label, 8, laneY - 14);

      for (const e of laneEvents) {
        if (e.kind === "bet") continue;
        const x = timeToX(new Date(e.at).getTime(), centerMs, pxPerDay, size.width);
        if (x < -20 || x > size.width + 20) continue;
        const y = laneY + (LANE_HEIGHT - 18) / 2;
        ctx.beginPath();
        ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = bet.color;
        ctx.fill();
        if (selected?.id === e.id) {
          ctx.strokeStyle = ink;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        // Labels only where there is room for them to be readable.
        if (pxPerDay > 0.08) {
          ctx.fillStyle = ink;
          ctx.fillText(truncate(e.title, 28), x + 9, y - 6);
        }
      }
    });

    // Events with no bet sit in their own lane under the three.
    const orphans = visible.filter((e) => !e.betKey);
    if (orphans.length > 0) {
      const laneY = LANE_TOP + LIFE_BETS.length * LANE_HEIGHT;
      ctx.fillStyle = muted;
      ctx.fillText("Other", 8, laneY - 14);
      for (const e of orphans) {
        const x = timeToX(new Date(e.at).getTime(), centerMs, pxPerDay, size.width);
        if (x < -20 || x > size.width + 20) continue;
        const y = laneY + (LANE_HEIGHT - 18) / 2;
        ctx.beginPath();
        ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = muted;
        ctx.fill();
        if (pxPerDay > 0.08) {
          ctx.fillStyle = ink;
          ctx.fillText(truncate(e.title, 28), x + 9, y - 6);
        }
      }
    }
  }, [centerMs, hidden, pxPerDay, selected, size.height, size.width, visible]);

  useEffect(() => {
    draw();
  }, [draw]);

  /* ----------------------------- interaction ------------------------------ */

  function hitTest(clientX: number, clientY: number): LifeTimelineEvent | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: { event: LifeTimelineEvent; distance: number } | null = null;

    const lanes: Array<{ key: string | null; index: number }> = [
      ...LIFE_BETS.map((b, i) => ({ key: b.key as string | null, index: i })),
      { key: null, index: LIFE_BETS.length },
    ];

    for (const lane of lanes) {
      const laneY = LANE_TOP + lane.index * LANE_HEIGHT + (LANE_HEIGHT - 18) / 2;
      if (Math.abs(y - laneY) > 14) continue;
      for (const e of visible) {
        if ((e.betKey ?? null) !== lane.key || e.kind === "bet") continue;
        const ex = timeToX(
          new Date(e.at).getTime(),
          centerMs,
          pxPerDay,
          size.width
        );
        const distance = Math.abs(ex - x);
        if (distance <= 12 && (!best || distance < best.distance)) {
          best = { event: e, distance };
        }
      }
    }
    return best?.event ?? null;
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: pxPerDay,
      };
      dragRef.current = null;
      return;
    }
    dragRef.current = { x: e.clientX, center: centerMs, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchRef.current.distance > 0) {
        setPxPerDay(
          clampScale(
            (pinchRef.current.scale * distance) / pinchRef.current.distance
          )
        );
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 3) drag.moved = true;
    setCenterMs(drag.center - (dx / pxPerDay) * MS_PER_DAY);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    // A tap that did not pan is a selection.
    if (drag && !drag.moved) setSelected(hitTest(e.clientX, e.clientY));
  }

  // Non-passive wheel listener: React's onWheel is passive, so preventDefault
  // there is ignored and the page scrolls behind the zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const anchorMs = xToTime(x, centerMs, pxPerDay, size.width);
      const next = clampScale(pxPerDay * Math.exp(-ev.deltaY * 0.002));
      // Keep the time under the cursor under the cursor.
      const nextCenter =
        anchorMs - ((x - size.width / 2) / next) * MS_PER_DAY;
      setPxPerDay(next);
      setCenterMs(nextCenter);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [centerMs, pxPerDay, size.width]);

  const tier = tierForScale(pxPerDay);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {LIFE_BETS.map((bet) => {
          const off = hidden.has(bet.key);
          return (
            <button
              key={bet.key}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(bet.key)) next.delete(bet.key);
                  else next.add(bet.key);
                  return next;
                })
              }
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                off
                  ? "border-border text-muted-foreground"
                  : "border-foreground text-foreground"
              }`}
            >
              <span aria-hidden>{bet.glyph} </span>
              {bet.label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {tier}
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[340px] w-full overflow-hidden rounded-2xl border border-border bg-background"
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {selected ? (
        <div className="mt-4 rounded-2xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-foreground">
                {selected.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {/* The label the user wrote wins over the parsed date. */}
                {selected.dueLabel ?? formatDay(selected.at)}
              </p>
              {selected.body ? (
                <p className="mt-2 text-sm text-foreground/90">
                  {selected.body}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
