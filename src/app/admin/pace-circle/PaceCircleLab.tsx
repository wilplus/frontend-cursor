"use client";

/* -------------------------------------------------------------------------- */
/*  The live pace scale (founder 2026-10-24, "No delay, please!!!"). One    */
/*  horizontal scale and one puffy dot, moved only by what is known at once:  */
/*  while you talk it moves right, the longer without a breath the further;   */
/*  while you pause it moves left, the longer the pause the further. Before   */
/*  you speak it is one long pause: far left, red. The dot's colour is its    */
/*  place: green in the middle half, orange towards the ends, red at the      */
/*  very edges. No averages, so nothing waits.                                */
/*                                                                            */
/*  Listen only. The microphone's loudness is read every 10 ms in this tab;   */
/*  no audio leaves it and nothing is recorded. The numbers panel is for      */
/*  tuning on this founder-only page; the speaker's screen will show none.    */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FRAME_MS,
  INSTANT_STOPS,
  InstantMeter,
  instantTarget,
  zoneLevel,
  type InstantRead,
  type InstantStops,
} from "./paceSignal";

// The dot's colours, kept here because the canvas needs real values.
const COLOURS = {
  green: [62, 169, 120],
  amber: [240, 146, 40],
  deep: [214, 66, 56],
} as const;

function dotRgb(level: number): string {
  const mix = (a: readonly number[], b: readonly number[], t: number) =>
    a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const c = level <= 1 ? mix(COLOURS.green, COLOURS.amber, level) : mix(COLOURS.amber, COLOURS.deep, level - 1);
  return `rgb(${c.join(",")})`;
}

type Phase = "idle" | "starting" | "listening" | "denied";

export default function PaceCircleLab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readRef = useRef<InstantRead | null>(null);
  const stopsRef = useRef<InstantStops>(INSTANT_STOPS);
  const stopRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [showNumbers, setShowNumbers] = useState(false);
  const [live, setLive] = useState<InstantRead | null>(null);
  const [greenRun, setGreenRun] = useState(INSTANT_STOPS.greenRunMs);
  const [redRun, setRedRun] = useState(INSTANT_STOPS.redRunMs);
  const [greenPause, setGreenPause] = useState(INSTANT_STOPS.greenPauseMs);
  const [redPause, setRedPause] = useState(INSTANT_STOPS.redPauseMs);
  stopsRef.current = {
    greenRunMs: greenRun,
    redRunMs: Math.max(redRun, greenRun + 500),
    greenPauseMs: greenPause,
    redPauseMs: Math.max(redPause, greenPause + 300),
  };

  // The numbers panel refreshes a few times a second, not every frame.
  useEffect(() => {
    if (!showNumbers) return;
    const id = window.setInterval(() => setLive(readRef.current), 250);
    return () => window.clearInterval(id);
  }, [showNumbers]);

  // Drawing: a critically damped spring, so the dot glides and never jumps.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ball = { x: -1, y: 0, vx: 0, vy: 0 };
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const read = readRef.current;
      // Nothing heard yet is one long pause: the far left.
      const target = read ? instantTarget(read, stopsRef.current) : -1;
      const k = reduce ? 80 : 40; // ~0.15 s glide: smooth, no lag
      const d = 2 * Math.sqrt(k);
      ball.vx += (k * (target - ball.x) - d * ball.vx) * dt;
      ball.x += ball.vx * dt;
      draw(ctx, canvas, ball, dotRgb(zoneLevel(ball.x)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    readRef.current = null;
    setPhase("idle");
  }, []);

  const start = useCallback(async () => {
    setPhase("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      setPhase("denied");
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audio = new AudioCtx();
    await audio.resume();
    const source = audio.createMediaStreamSource(stream);
    // Keep the voice's band, so hum and hiss count as room, not voice.
    const high = audio.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 250;
    const low = audio.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 3500;
    const analyser = audio.createAnalyser();
    analyser.fftSize = 32768; // ~0.7 s of samples, so a late tick still finds its frames
    source.connect(high).connect(low).connect(analyser);

    const meter = new InstantMeter();
    const buffer = new Float32Array(analyser.fftSize);
    const frameSamples = Math.max(1, Math.round((audio.sampleRate * FRAME_MS) / 1000));
    let lastTick = performance.now();
    setPhase("listening");

    const id = window.setInterval(() => {
      const now = performance.now();
      const frames = Math.min(20, Math.floor((now - lastTick) / FRAME_MS));
      if (frames <= 0) return;
      lastTick += frames * FRAME_MS;
      analyser.getFloatTimeDomainData(buffer);
      // One RMS per 10 ms slice of the newest samples, oldest first.
      for (let f = frames - 1; f >= 0; f--) {
        const end = buffer.length - f * frameSamples;
        const begin = Math.max(0, end - frameSamples);
        let sum = 0;
        for (let i = begin; i < end; i++) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / Math.max(1, end - begin));
        readRef.current = meter.push(20 * Math.log10(rms + 1e-9));
      }
    }, FRAME_MS);

    stopRef.current = () => {
      window.clearInterval(id);
      stream.getTracks().forEach((t) => t.stop());
      void audio.close();
    };
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  const listening = phase === "listening";
  const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-8">
      <div className="w-full">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Founder only · test bench</p>
        <h1 className="text-2xl font-semibold">Pace scale</h1>
        <p className="mt-1 text-sm text-muted-foreground">Listens only: nothing is recorded or sent.</p>
      </div>

      <div className="relative aspect-[4/1] w-full">
        <canvas ref={canvasRef} className="h-full w-full" aria-label="The pace scale" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {listening ? (
          <button type="button" onClick={stop} className="rounded-full bg-foreground px-6 py-3 text-background">
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={phase === "starting"}
            className="rounded-full bg-[#ff6a00] px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            Start
          </button>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            id="pace-circle-numbers"
            type="checkbox"
            checked={showNumbers}
            onChange={(e) => setShowNumbers(e.target.checked)}
          />
          Show the numbers (for tuning)
        </label>
      </div>
      {phase === "denied" && (
        <p className="text-sm text-red-600">
          The microphone is blocked. Allow it for this site in the browser&apos;s settings, then press Start again.
        </p>
      )}

      {showNumbers && (
        <div className="grid w-full gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
            <dt className="text-muted-foreground">Room (learned as it goes)</dt>
            <dd>{live ? `${live.floorDb.toFixed(1)} dB` : "—"}</dd>
            <dt className="text-muted-foreground">Voice</dt>
            <dd>{live?.voiced ? "speaking" : "quiet"}</dd>
            <dt className="text-muted-foreground">Talking without a pause</dt>
            <dd>{live?.runMs ? sec(live.runMs) : "—"}</dd>
            <dt className="text-muted-foreground">Pause now</dt>
            <dd>{live?.pauseMs ? (live.pauseMs > 60000 ? "long" : sec(live.pauseMs)) : "—"}</dd>
          </dl>
          <div className="flex flex-col gap-3">
            <Slider id="pc-green-run" label="Talking: green up to" value={greenRun} min={1000} max={8000} step={250}
              show={sec(greenRun)} onChange={setGreenRun} />
            <Slider id="pc-red-run" label="Talking: red after" value={redRun} min={3000} max={15000} step={500}
              show={sec(redRun)} onChange={setRedRun} />
            <Slider id="pc-green-pause" label="Pause: green up to" value={greenPause} min={300} max={2500} step={100}
              show={sec(greenPause)} onChange={setGreenPause} />
            <Slider id="pc-red-pause" label="Pause: red after" value={redPause} min={1000} max={6000} step={100}
              show={sec(redPause)} onChange={setRedPause} />
          </div>
        </div>
      )}
    </div>
  );
}

function Slider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  show: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.id} className="flex justify-between text-xs text-muted-foreground">
        <span>{props.label}</span>
        <span className="tabular-nums">{props.show}</span>
      </label>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-[#ff6a00]"
      />
    </div>
  );
}

/** Where the scale's centre sits: 27% of the way from the middle of the bar
 *  towards its right end (founder 2026-10-24, "let's see how it goes"; set
 *  it back to 0 to undo). The left (pausing) side gets longer, the right
 *  (talking) side shorter; the ends stay the ends. */
const CENTRE_SHIFT = 0.27;
const place = (x: number) => (x < 0 ? CENTRE_SHIFT + x * (1 + CENTRE_SHIFT) : CENTRE_SHIFT + x * (1 - CENTRE_SHIFT));

function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, ball: { x: number }, dot: string) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cy = h / 2;
  const pad = Math.max(24, h * 0.35);
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
    ctx.moveTo(cx + place(from) * half, cy);
    ctx.lineTo(cx + place(to) * half, cy);
    ctx.stroke();
  };
  ctx.lineCap = "butt";
  tint(-0.5, 0.5, COLOURS.green, 0.22);
  tint(-0.9, -0.5, COLOURS.amber, 0.16);
  tint(0.5, 0.9, COLOURS.amber, 0.16);
  tint(-1, -0.9, COLOURS.deep, 0.16);
  tint(0.9, 1, COLOURS.deep, 0.16);

  // ticks: the centre, the green middle's edges and the ends
  ctx.strokeStyle = "#8a8f96";
  for (const q of [-1, -0.5, 0, 0.5, 1]) {
    const x = cx + place(q) * half;
    const len = q === 0 ? track * 1.6 : track * 0.9;
    ctx.globalAlpha = q === 0 ? 0.55 : 0.3;
    ctx.lineWidth = q === 0 ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, cy - len);
    ctx.lineTo(x, cy + len);
    ctx.stroke();
  }

  // the dot: puffy, in the pause's colour, gently breathing
  const bx = Math.max(-1, Math.min(1, ball.x));
  const x = cx + place(bx) * half;
  const r = Math.max(14, h * 0.2); // steady: no breathing, so a still dot means silence
  const halo = ctx.createRadialGradient(x, cy, r * 0.8, x, cy, r * 2.2);
  halo.addColorStop(0, dot);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, cy, r * 2.2, 0, Math.PI * 2);
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
