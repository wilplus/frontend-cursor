"use client";

import { useEffect, useRef, useState } from "react";

/* A small voice player (prototype version 27: the speaker's orange voice
   bubble, and the grey "How you said it" under the key line). It plays one
   recording kept by the plan; the bars are drawn, not measured. */

function bars(n: number, seed: number): number[] {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 9301 + 49297) % 233280;
    return 0.25 + (s / 233280) * 0.75;
  });
}

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function seedOf(src: string): number {
  let h = 7;
  for (let i = 0; i < src.length; i += 1) h = (h * 31 + src.charCodeAt(i)) % 233280;
  return h;
}

export function VoicePlayer({
  src,
  tone,
  label,
  durationMs,
}: {
  src: string;
  tone: "orange" | "grey";
  label?: string;
  durationMs?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = () => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(src);
      audio.ontimeupdate = () => {
        const a = audioRef.current;
        if (a && a.duration > 0) setProgress(a.currentTime / a.duration);
      };
      audio.onended = () => {
        setPlaying(false);
        setProgress(0);
      };
      audioRef.current = audio;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const orange = tone === "orange";
  const heights = bars(orange ? 24 : 18, seedOf(src));
  const lit = Math.round(progress * heights.length);
  return (
    <div className="flex items-center gap-2.5" data-plan-player>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${orange ? "bg-white" : "bg-[#E2E2E2]"}`}
      >
        {playing ? (
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
            <rect x="1" y="1" width="3" height="10" rx="1" fill={orange ? "#FF640A" : "#121212"} />
            <rect x="6" y="1" width="3" height="10" rx="1" fill={orange ? "#FF640A" : "#121212"} />
          </svg>
        ) : (
          <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
            <path d="M2 1.2v10.6L11 6.5z" fill={orange ? "#FF640A" : "#121212"} />
          </svg>
        )}
      </button>
      <div className="flex h-6 items-center gap-[2px]" aria-hidden="true">
        {heights.map((h, i) => (
          <i
            key={i}
            className={`block w-[3px] rounded-full ${
              orange ? (i < lit ? "bg-white" : "bg-white/55") : i < lit ? "bg-[#121212]" : "bg-[#BDBDBD]"
            }`}
            style={{ height: `${Math.round(h * 22)}px` }}
          />
        ))}
      </div>
      {label ? <span className="text-[13px] text-[#6B6B6B]">{label}</span> : null}
      {!label && durationMs ? (
        <span className={`text-[13px] tabular-nums ${orange ? "text-white" : "text-[#6B6B6B]"}`}>{clock(durationMs)}</span>
      ) : null}
    </div>
  );
}
