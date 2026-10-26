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
import { INSTANT_CONFIG, type InstantRead, type InstantConfig } from "@/lib/willab/pace/paceSignal";
import { startPaceMic, type PaceMic } from "@/lib/willab/pace/paceMic";
import PaceScale, { PACE_END_INSET as END_INSET } from "@/components/willab/pace/PaceScale";

type Phase = "idle" | "starting" | "listening" | "denied";

export default function PaceCircleLab() {
  const readRef = useRef<InstantRead | null>(null);
  const cfgRef = useRef<InstantConfig>(INSTANT_CONFIG);
  const micRef = useRef<PaceMic | null>(null);
  const [voiceLikeLive, setVoiceLikeLive] = useState(0);

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
  if (micRef.current) micRef.current.meter.cfg = cfgRef.current;

  // The numbers panel refreshes a few times a second, not every frame.
  useEffect(() => {
    if (!showNumbers) return;
    const id = window.setInterval(() => {
      setLive(readRef.current);
      setVoiceLikeLive(micRef.current?.voiceLike() ?? 0);
    }, 250);
    return () => window.clearInterval(id);
  }, [showNumbers]);

  const stop = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    readRef.current = null;
    setPhase("idle");
  }, []);

  const start = useCallback(async () => {
    setPhase("starting");
    const mic = await startPaceMic((read) => {
      readRef.current = read;
    }, cfgRef.current);
    if (!mic) {
      setPhase("denied");
      return;
    }
    micRef.current = mic;
    setPhase("listening");
  }, []);

  useEffect(() => () => micRef.current?.stop(), []);

  const listening = phase === "listening";
  const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-8">
      <div className="w-full">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Founder only · test bench</p>
        <h1 className="text-2xl font-semibold">Pace scale</h1>
        <p className="mt-1 text-sm text-muted-foreground">Listens only: nothing is recorded or sent.</p>
      </div>

      <PaceScale
        activity={() => readRef.current?.activity ?? null}
        label="The pace scale"
        className="h-[clamp(150px,22vw,260px)]"
      >
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
      </PaceScale>

      <p className="text-xs text-muted-foreground">
        Version 25 Oct, 07:00 · above 0.75 any gap brings it back fast; below 0.37 it sinks 60% slower · 0.3 → 0.5 at 50%, 0.5 → 1 at 25% speed, unless 22 s without a pause · speaking: 0 → 0.5 in {sec(riseJump)}, 0.5 → 0.65 in {sec(riseBase)}, 0.65 → 0.75 in{" "}
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
