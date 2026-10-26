"use client";

/* -------------------------------------------------------------------------- */
/*  PaceScale — the pace scale's drawing (backend N142, `pace-scale-v1`).     */
/*                                                                            */
/*  One horizontal bar and one puffy dot. The dot glides to the meter's       */
/*  activity on a critically damped spring: silence rests it on the left,     */
/*  talking with no gaps carries it right, normal speech sits between. Its    */
/*  colour is its place: green in the middle half, orange towards the ends,  */
/*  red at the very edges. No number is drawn (Never 1). Shared by the        */
/*  founder's bench and the walk's tempo step.                                */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, type ReactNode } from "react";
import { zoneLevel } from "@/lib/willab/pace/paceSignal";

// The dot's colours, kept here because the canvas needs real values.
export const PACE_COLOURS = {
  green: [62, 169, 120],
  amber: [240, 146, 40],
  deep: [214, 66, 56],
} as const;

export function paceRgb(level: number): string {
  const mix = (a: readonly number[], b: readonly number[], t: number) =>
    a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const c = level <= 1 ? mix(PACE_COLOURS.green, PACE_COLOURS.amber, level) : mix(PACE_COLOURS.amber, PACE_COLOURS.deep, level - 1);
  return `rgb(${c.join(",")})`;
}

/** The bar's ends sit this far in from the canvas edges (share of width). */
export const PACE_END_INSET = 0.07;

/**
 * @param activity the meter's activity now, 0..1; null: nothing heard yet,
 *   the dot rests on the left.
 * @param asleep drawn faded and still, before the speaker is ready.
 */
export default function PaceScale({
  activity,
  asleep = false,
  label,
  className,
  children,
}: {
  activity: () => number | null;
  asleep?: boolean;
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const asleepRef = useRef(asleep);
  asleepRef.current = asleep;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const ball = { x: -1, vx: 0 };
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    ro?.observe(canvas);
    resize();

    const frame = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const a = asleepRef.current ? null : activityRef.current();
      const target = a == null ? -1 : a * 2 - 1;
      const k = reduce ? 80 : 40; // ~0.15 s glide: smooth, no lag
      const d = 2 * Math.sqrt(k);
      ball.vx += (k * (target - ball.x) - d * ball.vx) * dt;
      ball.x += ball.vx * dt;
      drawPaceScale(ctx, canvas, ball.x, paceRgb(zoneLevel(ball.x)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className={`relative w-full ${asleep ? "opacity-45" : ""} ${className ?? ""}`}>
      <canvas ref={canvasRef} className="h-full w-full" aria-label={label} />
      {children}
    </div>
  );
}

function drawPaceScale(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, at: number, dot: string) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cy = h / 2;
  const pad = w * PACE_END_INSET;
  const left = pad;
  const right = w - pad;
  const half = (right - left) / 2;
  const cx = left + half;
  const track = Math.max(10, h * 0.12);
  ctx.clearRect(0, 0, w, h);

  // the scale: one soft rounded bar
  ctx.globalAlpha = 1;
  ctx.lineCap = "round";
  ctx.lineWidth = track;
  const bar = ctx.createLinearGradient(0, cy - track / 2, 0, cy + track / 2);
  bar.addColorStop(0, "#f4f2ee");
  bar.addColorStop(1, "#e2ded7");
  ctx.strokeStyle = bar;
  ctx.beginPath();
  ctx.moveTo(left, cy);
  ctx.lineTo(right, cy);
  ctx.stroke();

  // faint tints for the three stretches: green middle, orange, red edges
  const tint = (from: number, to: number, rgb: readonly number[], alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgb(${rgb.join(",")})`;
    ctx.lineWidth = track;
    ctx.beginPath();
    ctx.moveTo(cx + from * half, cy);
    ctx.lineTo(cx + to * half, cy);
    ctx.stroke();
  };
  ctx.lineCap = "butt";
  tint(-0.5, 0.5, PACE_COLOURS.green, 0.22);
  tint(-0.9, -0.5, PACE_COLOURS.amber, 0.16);
  tint(0.5, 0.9, PACE_COLOURS.amber, 0.16);
  tint(-1, -0.9, PACE_COLOURS.deep, 0.16);
  tint(0.9, 1, PACE_COLOURS.deep, 0.16);

  // ticks: the centre, the green middle's edges and the ends
  ctx.strokeStyle = "#8a8f96";
  for (const q of [-1, -0.5, 0, 0.5, 1]) {
    const x = cx + q * half;
    const len = q === 0 ? track * 1.6 : track * 0.9;
    ctx.globalAlpha = q === 0 ? 0.55 : 0.3;
    ctx.lineWidth = q === 0 ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, cy - len);
    ctx.lineTo(x, cy + len);
    ctx.stroke();
  }

  // the dot: puffy, steady (a still dot means silence), inside the canvas at the ends
  const x = cx + Math.max(-1, Math.min(1, at)) * half;
  const r = Math.max(12, Math.min(h * 0.16, w * PACE_END_INSET * 0.6));
  const halo = ctx.createRadialGradient(x, cy, r * 0.8, x, cy, r * 1.7);
  halo.addColorStop(0, dot);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, cy, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.ellipse(x, cy + r * 0.95, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const grad = ctx.createRadialGradient(x - r * 0.35, cy - r * 0.4, r * 0.1, x, cy, r);
  grad.addColorStop(0, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.35, dot);
  grad.addColorStop(1, dot);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
}
