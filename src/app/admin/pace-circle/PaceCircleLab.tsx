"use client";

/* -------------------------------------------------------------------------- */
/*  The Pace Circle test bench (founder 2026-10-24; N130, N133, N134). One soft      */
/*  circle, one puffy orange ball: speed moves it left and right, how much    */
/*  of the time the founder pauses moves it up and down, and the rim shows    */
/*  the pause happening now (green, amber, deep amber, never red).            */
/*                                                                            */
/*  Listen only. The microphone's loudness is read every 10 ms in this tab;   */
/*  no audio leaves it and nothing is recorded. The numbers panel is for      */
/*  tuning on this founder-only page; the speaker's screen will show none.    */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FRAME_MS,
  PaceMeter,
  RESEARCH_CENTRE,
  RIM_STOPS,
  ballTarget,
  blendCentre,
  foldSession,
  median,
  rimLevel,
  type Centre,
  type PaceRead,
  type Personal,
} from "./paceSignal";

const STORE_KEY = "paceCircle.personal.v1";

function loadPersonal(): Personal | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Personal) : null;
  } catch {
    return null;
  }
}
function savePersonal(p: Personal | null) {
  try {
    if (p) window.localStorage.setItem(STORE_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    /* private window or blocked storage: the baseline just isn't kept */
  }
}

// Colours of the circle, kept here because the canvas needs real values.
const COLOURS = {
  green: [62, 169, 120],
  amber: [240, 162, 58],
  deep: [214, 120, 40],
  ball: [255, 106, 0],
} as const;

function rimRgb(level: number): string {
  const mix = (a: readonly number[], b: readonly number[], t: number) =>
    a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const c = level <= 1 ? mix(COLOURS.green, COLOURS.amber, level) : mix(COLOURS.amber, COLOURS.deep, level - 1);
  return `rgb(${c.join(",")})`;
}

type Phase = "idle" | "starting" | "calibrating" | "listening" | "denied";

export default function PaceCircleLab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readRef = useRef<PaceRead | null>(null);
  const centreRef = useRef<Centre>(RESEARCH_CENTRE);
  const stopsRef = useRef(RIM_STOPS);
  const stopRef = useRef<(() => void) | null>(null);
  const speedsRef = useRef<number[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [showNumbers, setShowNumbers] = useState(false);
  const [live, setLive] = useState<PaceRead | null>(null);
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [researchSpeed, setResearchSpeed] = useState(RESEARCH_CENTRE.speed);
  const [researchShare, setResearchShare] = useState(RESEARCH_CENTRE.share);
  const [amberMs, setAmberMs] = useState(RIM_STOPS.amberMs);
  const [deepMs, setDeepMs] = useState(RIM_STOPS.deepMs);

  useEffect(() => setPersonal(loadPersonal()), []);

  const { centre, weight } = blendCentre({ speed: researchSpeed, share: researchShare }, personal);
  centreRef.current = centre;
  stopsRef.current = { amberMs, deepMs: Math.max(deepMs, amberMs + 500) };

  // The numbers panel refreshes a few times a second, not every frame.
  useEffect(() => {
    if (!showNumbers) return;
    const id = window.setInterval(() => setLive(readRef.current), 250);
    return () => window.clearInterval(id);
  }, [showNumbers]);

  // Drawing: a critically damped spring, so the ball drifts and never jumps.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ball = { x: 0, y: 0, vx: 0, vy: 0 };
    let held = { x: 0, y: 0 };
    let glow = 0;
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
      if (read?.calibrated) held = ballTarget(read, centreRef.current, held);
      const k = reduce ? 12 : 6; // ~0.4 s to settle: smooth, never laggy (N134)
      const d = 2 * Math.sqrt(k);
      ball.vx += (k * (held.x - ball.x) - d * ball.vx) * dt;
      ball.vy += (k * (held.y - ball.y) - d * ball.vy) * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      const pauseMs = read?.pauseMs ?? 0;
      glow += ((pauseMs > 0 ? 1 : 0.5) - glow) * Math.min(1, dt * 3);
      draw(ctx, canvas, ball, rimRgb(rimLevel(pauseMs, stopsRef.current)), glow, now / 1000, reduce);
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
    const read = readRef.current;
    const speed = median(speedsRef.current);
    if (read?.calibrated && speed !== null && read.share !== null && read.speechSec >= 20) {
      const next = foldSession(loadPersonal(), { speechMinutes: read.speechSec / 60, speed, share: read.share });
      savePersonal(next);
      setPersonal(next);
    }
    speedsRef.current = [];
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
    // Keep the voice's vowel band, where syllables are loudest.
    const high = audio.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 250;
    const low = audio.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 3500;
    const analyser = audio.createAnalyser();
    analyser.fftSize = 32768; // ~0.7 s of samples, so a late tick still finds its frames
    source.connect(high).connect(low).connect(analyser);

    const meter = new PaceMeter();
    const buffer = new Float32Array(analyser.fftSize);
    const frameSamples = Math.max(1, Math.round((audio.sampleRate * FRAME_MS) / 1000));
    let lastTick = performance.now();
    let lastSpeedSample = 0;
    setPhase("calibrating");

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
        const read = meter.push(20 * Math.log10(rms + 1e-9));
        readRef.current = read;
      }
      const read = readRef.current;
      if (read?.calibrated) {
        setPhase((p) => (p === "calibrating" ? "listening" : p));
        if (read.speed !== null && now - lastSpeedSample > 1000) {
          speedsRef.current.push(read.speed);
          lastSpeedSample = now;
        }
      }
    }, FRAME_MS);

    stopRef.current = () => {
      window.clearInterval(id);
      stream.getTracks().forEach((t) => t.stop());
      void audio.close();
    };
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  const listening = phase === "calibrating" || phase === "listening";

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-8">
      <div className="w-full">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Founder only · test bench</p>
        <h1 className="text-2xl font-semibold">Pace Circle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listens only: nothing is recorded or sent. Your baseline stays in this browser.
        </p>
      </div>

      <div className="relative aspect-square w-full max-w-[min(90vw,560px)]">
        <canvas ref={canvasRef} className="h-full w-full" aria-label="The Pace Circle" />
        {phase === "calibrating" && (
          <p className="absolute inset-x-0 bottom-2 text-center text-sm text-muted-foreground">
            Stay quiet for two seconds while it hears the room…
          </p>
        )}
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
            <dt className="text-muted-foreground">Room (noise floor)</dt>
            <dd>{live?.floorDb != null ? `${live.floorDb.toFixed(1)} dB` : "—"}</dd>
            <dt className="text-muted-foreground">Voice</dt>
            <dd>{live?.voiced ? "speaking" : "quiet"}</dd>
            <dt className="text-muted-foreground">Speed</dt>
            <dd>{live?.speed != null ? `${live.speed.toFixed(2)} syll/s` : "not enough speech yet"}</dd>
            <dt className="text-muted-foreground">Share silent</dt>
            <dd>{live?.share != null ? `${Math.round(live.share * 100)}%` : "listening…"}</dd>
            <dt className="text-muted-foreground">Pause now</dt>
            <dd>{live?.pauseMs ? `${(live.pauseMs / 1000).toFixed(1)} s` : "—"}</dd>
            <dt className="text-muted-foreground">Speech this session</dt>
            <dd>{live ? `${live.speechSec.toFixed(0)} s` : "—"}</dd>
            <dt className="text-muted-foreground">Centre in use</dt>
            <dd>
              {centre.speed.toFixed(2)} syll/s · {Math.round(centre.share * 100)}% silent
            </dd>
            <dt className="text-muted-foreground">Your own share of it</dt>
            <dd>
              {Math.round(weight * 100)}%
              {personal ? ` (from ${personal.speechMinutes.toFixed(1)} min of speech)` : ""}
            </dd>
          </dl>
          <div className="flex flex-col gap-3">
            <Slider id="pc-speed" label="Research speed centre" value={researchSpeed} min={3.5} max={6.5} step={0.1}
              show={`${researchSpeed.toFixed(1)} syll/s`} onChange={setResearchSpeed} />
            <Slider id="pc-share" label="Research share centre" value={researchShare} min={0.1} max={0.5} step={0.01}
              show={`${Math.round(researchShare * 100)}%`} onChange={setResearchShare} />
            <Slider id="pc-amber" label="Rim turns amber at" value={amberMs} min={600} max={2500} step={100}
              show={`${(amberMs / 1000).toFixed(1)} s`} onChange={setAmberMs} />
            <Slider id="pc-deep" label="Rim turns deep amber at" value={deepMs} min={1500} max={5000} step={100}
              show={`${(deepMs / 1000).toFixed(1)} s`} onChange={setDeepMs} />
            <button
              type="button"
              onClick={() => {
                savePersonal(null);
                setPersonal(null);
              }}
              className="self-start rounded-full border px-4 py-1.5 text-xs"
            >
              Forget my baseline
            </button>
            <p className="text-xs text-muted-foreground">
              A session of 20 seconds of speech or more joins your baseline when you press Stop.
            </p>
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

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ball: { x: number; y: number },
  rim: string,
  glow: number,
  t: number,
  reduce: boolean,
) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.36;
  ctx.clearRect(0, 0, w, h);

  // the rim's soft glow
  const halo = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.35);
  halo.addColorStop(0, rim);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.3 * glow;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // the puffy disc
  ctx.globalAlpha = 1;
  const disc = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  disc.addColorStop(0, "#ffffff");
  disc.addColorStop(1, "#ece9e3");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(6, R * 0.05);
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // the centre, faint
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#8a8f96";
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // the ball, kept inside the disc, gently breathing
  let bx = ball.x;
  let by = -ball.y;
  const m = Math.hypot(bx, by);
  if (m > 0.82) {
    bx *= 0.82 / m;
    by *= 0.82 / m;
  }
  const x = cx + bx * R;
  const y = cy + by * R;
  const r = R * 0.16 * (1 + (reduce ? 0 : Math.sin(t * 1.6) * 0.03));
  const [br, bg, bb] = COLOURS.ball;
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  grad.addColorStop(0, "#ffb27a");
  grad.addColorStop(1, `rgb(${br},${bg},${bb})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
