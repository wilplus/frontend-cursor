"use client";

/* -------------------------------------------------------------------------- */
/*  The live pace scale (founder 2026-10-24: "use the metric that can be    */
/*  calculated and processed real time ... there is no delay"). One          */
/*  horizontal scale and one puffy dot, moved by one signal recalculated     */
/*  every 10 ms: how much of the last half second had voice in it. Silence   */
/*  rests it on 0 (left); talking with no gaps carries it to 1 (right);      */
/*  normal speech, with its small gaps, sits between. Its colour is its      */
/*  place: green in the middle half, orange towards the ends, red at the     */
/*  very edges.                                                              */
/*                                                                            */
/*  Listen only. The microphone's loudness is read every 10 ms in this tab;   */
/*  no audio leaves it and nothing is recorded. The numbers panel is for      */
/*  tuning on this founder-only page; the speaker's screen will show none.    */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FRAME_MS,
  INSTANT_CONFIG,
  InstantMeter,
  periodicity,
  zoneLevel,
  type InstantRead,
  type InstantConfig,
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
  const cfgRef = useRef<InstantConfig>(INSTANT_CONFIG);
  const meterRef = useRef<InstantMeter | null>(null);
  const voiceLikeRef = useRef(0);
  const [voiceLikeLive, setVoiceLikeLive] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [showNumbers, setShowNumbers] = useState(false);
  const [live, setLive] = useState<InstantRead | null>(null);
  const [marginDb, setMarginDb] = useState(INSTANT_CONFIG.voiceMarginDb);
  const [minPitch, setMinPitch] = useState(INSTANT_CONFIG.minPeriodicity);
  const [fallUpper, setFallUpper] = useState(INSTANT_CONFIG.fallUpperMs);
  const [fallLower, setFallLower] = useState(INSTANT_CONFIG.fallLowerMs);
  const [riseJump, setRiseJump] = useState(INSTANT_CONFIG.riseJumpMs);
  const [riseBase, setRiseBase] = useState(INSTANT_CONFIG.riseBaseMs);
  cfgRef.current = {
    ...INSTANT_CONFIG,
    voiceMarginDb: marginDb,
    silenceMarginDb: Math.max(2, marginDb - 5),
    minPeriodicity: minPitch,
    fallUpperMs: fallUpper,
    fallLowerMs: fallLower,
    riseJumpMs: riseJump,
    riseBaseMs: riseBase,
  };
  // Seconds of continuous voice for each climb stage, for the version line.
  const midMs = ((riseBase / 0.15) * 0.1) / INSTANT_CONFIG.riseMidBoost;
  const topMs = ((riseBase / 0.15) * 0.25) / INSTANT_CONFIG.riseTopBoost;
  if (meterRef.current) meterRef.current.cfg = cfgRef.current;

  // The numbers panel refreshes a few times a second, not every frame.
  useEffect(() => {
    if (!showNumbers) return;
    const id = window.setInterval(() => {
      setLive(readRef.current);
      setVoiceLikeLive(voiceLikeRef.current);
    }, 250);
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
      // How much of the last moment had voice: 0 silence (left) .. 1 no gaps (right).
      const target = read ? read.activity * 2 - 1 : -1;
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
    // A second, lower branch to hear pitch: a voice's fundamental and first
    // harmonics live under 1 kHz; hum under 70 Hz is cut.
    const pitchHigh = audio.createBiquadFilter();
    pitchHigh.type = "highpass";
    pitchHigh.frequency.value = 70;
    const pitchLow = audio.createBiquadFilter();
    pitchLow.type = "lowpass";
    pitchLow.frequency.value = 1000;
    const pitchAnalyser = audio.createAnalyser();
    pitchAnalyser.fftSize = 2048;
    source.connect(pitchHigh).connect(pitchLow).connect(pitchAnalyser);
    const pitchBuf = new Float32Array(pitchAnalyser.fftSize);
    // Every 4th sample (the branch is under 1 kHz), the newest ~40 ms.
    const step = 4;
    const pitchRate = audio.sampleRate / step;
    const pitchWin = new Float32Array(Math.round(pitchRate * 0.04));

    const meter = new InstantMeter(cfgRef.current);
    meterRef.current = meter;
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
      pitchAnalyser.getFloatTimeDomainData(pitchBuf);
      const startAt = pitchBuf.length - pitchWin.length * step;
      for (let i = 0; i < pitchWin.length; i++) pitchWin[i] = pitchBuf[startAt + i * step];
      const voiceLike = periodicity(pitchWin, pitchRate);
      voiceLikeRef.current = voiceLike;
      // One RMS per 10 ms slice of the newest samples, oldest first.
      for (let f = frames - 1; f >= 0; f--) {
        const end = buffer.length - f * frameSamples;
        const begin = Math.max(0, end - frameSamples);
        let sum = 0;
        for (let i = begin; i < end; i++) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / Math.max(1, end - begin));
        readRef.current = meter.push(20 * Math.log10(rms + 1e-9), voiceLike);
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

      <div className="relative w-full" style={{ height: "clamp(150px, 22vw, 260px)" }}>
        <canvas ref={canvasRef} className="h-full w-full" aria-label="The pace scale" />
        {/* 0 and 1 under the bar's ends (founder 2026-10-24; founder-only bench) */}
        <span
          className="pointer-events-none absolute top-[74%] -translate-x-1/2 text-3xl font-bold text-foreground"
          style={{ left: `${END_INSET * 100}%` }}
        >
          0
        </span>
        <span
          className="pointer-events-none absolute top-[74%] translate-x-1/2 text-3xl font-bold text-foreground"
          style={{ right: `${END_INSET * 100}%` }}
        >
          1
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Version 24 Oct, 20:00 · 0.5 → 1 half as fast, slower past 0.6 and 0.75, unless 22 s without a pause · speaking: 0 → 0.5 in {sec(riseJump)}, 0.5 → 0.65 in {sec(riseBase)}, 0.65 → 0.75 in{" "}
        {sec(midMs)}, 0.75 → 1 in {sec(topMs)} · pausing: 1 → 0.5 in {sec(fallUpper)}, 0.5 → 0 in {sec(fallLower)}
      </p>

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
            <dt className="text-muted-foreground">How voice-like the sound is now</dt>
            <dd>{live ? `${Math.round(voiceLikeLive * 100)}%` : "—"}</dd>
            <dt className="text-muted-foreground">Voice in the last moment</dt>
            <dd>{live ? `${Math.round(live.activity * 100)}%` : "—"}</dd>
          </dl>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground">While you speak (seconds of voice)</p>
            <Slider id="pc-rise-jump" label="From 0 to the middle" value={riseJump} min={200} max={4000} step={100}
              show={sec(riseJump)} onChange={setRiseJump} />
            <Slider id="pc-rise-base" label="From the middle to 0.65 (then it speeds up)" value={riseBase} min={300} max={8000} step={100}
              show={sec(riseBase)} onChange={setRiseBase} />
            <p className="text-xs font-semibold text-muted-foreground">While you pause</p>
            <Slider id="pc-fall-upper" label="From 1 back to the middle" value={fallUpper} min={300} max={8000} step={100}
              show={sec(fallUpper)} onChange={setFallUpper} />
            <Slider id="pc-fall-lower" label="From the middle down to 0" value={fallLower} min={500} max={15000} step={250}
              show={sec(fallLower)} onChange={setFallLower} />
            <p className="text-xs font-semibold text-muted-foreground">What counts as your voice</p>
            <Slider id="pc-pitch" label="How voice-like (higher ignores more breaths and noise)" value={minPitch} min={0.3} max={0.9} step={0.05}
              show={`${Math.round(minPitch * 100)}%`} onChange={setMinPitch} />
            <Slider id="pc-margin" label="How much louder than the room (higher ignores more noise)" value={marginDb} min={8} max={30} step={1}
              show={`${marginDb} dB`} onChange={setMarginDb} />
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

/** Where the scale's centre sits: the middle of the bar (founder 2026-10-24:
 *  tried 27% right and 27% left, then "bring it back do not move anything").
 *  Kept as one setting in case it is tried again. */
const CENTRE_SHIFT = 0;
/** The bar's ends sit this far in from the canvas edges (share of width). */
const END_INSET = 0.07;
const place = (x: number) => (x < 0 ? CENTRE_SHIFT + x * (1 + CENTRE_SHIFT) : CENTRE_SHIFT + x * (1 - CENTRE_SHIFT));

function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, ball: { x: number }, dot: string) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cy = h / 2;
  const pad = w * END_INSET; // the bar's ends; the 0 and 1 labels sit under them
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
  // steady (no breathing, so a still dot means silence), and small enough to stay inside the canvas at the ends
  const r = Math.max(12, Math.min(h * 0.16, w * END_INSET * 0.6));
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
