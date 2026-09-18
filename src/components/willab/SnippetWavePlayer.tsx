"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  SnippetWavePlayer — the Voice Album's clip player.                         */
/*                                                                            */
/*  The Album stopped showing the fragment's transcript (founder 2026-09-18:   */
/*  "don't display the transcript of the fragment just the playback"), which   */
/*  left two moments in a list looking identical. The waveform is what tells    */
/*  them apart now, so it is drawn per clip rather than decorative: the bar     */
/*  heights come from a deterministic hash of the moment key, so one moment      */
/*  keeps the same silhouette across reloads, devices and re-renders.           */
/*                                                                            */
/*  It is NOT the real envelope of the audio — we do not decode the file to     */
/*  draw it, and it must never be read as one. It is a stable visual name.      */
/*                                                                            */
/*  Clamping is MediaPlayer's, because the audio behind a snippet is usually    */
/*  a concatenated take: seek to startOffsetMs on load and on play, and pause   */
/*  + rewind at the slice end so a press of play replays only this moment.      */
/* -------------------------------------------------------------------------- */

const BAR_COUNT = 44;

/** FNV-1a then xorshift — same pattern per id, everywhere, forever. */
function barsFor(seed: string): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    hash ^= hash << 13;
    hash >>>= 0;
    hash ^= hash >> 17;
    hash ^= hash << 5;
    hash >>>= 0;
    const t = i / (BAR_COUNT - 1);
    // Speech starts and ends quieter than its middle; the envelope keeps the
    // shapes reading as voice rather than as noise.
    const envelope = 0.45 + 0.55 * Math.sin(Math.PI * Math.pow(t, 0.85));
    out.push(Math.max(3, Math.round((6 + ((hash % 1000) / 1000) * 26) * envelope)));
  }
  return out;
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(whole / 60);
  return `${mins}:${String(whole % 60).padStart(2, "0")}`;
}

export default function SnippetWavePlayer({
  seed,
  src,
  startOffsetMs = 0,
  durationMs,
  size = "default",
  label,
}: {
  /** Stable identity for the waveform — the moment key, or an attempt id. */
  seed: string;
  src: string | null;
  startOffsetMs?: number | null;
  durationMs?: number | null;
  size?: "default" | "compact";
  /** Accessible name; the visual has no text of its own. */
  label: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [errored, setErrored] = useState(false);

  const bars = useMemo(() => barsFor(seed), [seed]);
  const seekSec = (startOffsetMs ?? 0) / 1000;
  const clipDuration =
    typeof durationMs === "number" && durationMs > 0 ? durationMs / 1000 : mediaDuration;
  const clipEndSec = seekSec + clipDuration;
  const disabled = !src || errored;

  useEffect(() => {
    setErrored(false);
    setMediaDuration(0);
    setElapsed(0);
  }, [src]);

  const handleLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!(typeof durationMs === "number" && durationMs > 0)) {
      setMediaDuration(Number.isFinite(el.duration) ? el.duration : 0);
    }
    if (seekSec > 0) el.currentTime = seekSec;
  }, [durationMs, seekSec]);

  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (clipDuration > 0 && el.currentTime >= clipEndSec) {
      el.pause();
      el.currentTime = seekSec;
      setPlaying(false);
      setElapsed(0);
      return;
    }
    setElapsed(Math.max(0, el.currentTime - seekSec));
  }, [clipDuration, clipEndSec, seekSec]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || disabled) return;
    if (playing) {
      el.pause();
      return;
    }
    if (el.currentTime < seekSec || el.currentTime >= clipEndSec) {
      el.currentTime = seekSec;
    }
    void el.play().catch(() => setPlaying(false));
  }, [clipEndSec, disabled, playing, seekSec]);

  const fraction = clipDuration > 0 ? Math.min(1, elapsed / clipDuration) : 0;
  const litBars = Math.round(fraction * bars.length);
  const Icon = playing ? Pause : Play;
  const compact = size === "compact";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        aria-pressed={playing}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform",
          compact ? "h-8 w-8" : "h-[42px] w-[42px]",
          disabled ? "cursor-not-allowed opacity-50" : "hover:scale-105"
        )}
      >
        <Icon className={cn("fill-current", compact ? "h-3 w-3" : "h-4 w-4")} aria-hidden />
      </button>

      <span
        className={cn("flex min-w-0 flex-1 items-center gap-[2px]", compact ? "h-[22px]" : "h-[34px]")}
        aria-hidden
      >
        {bars.map((height, index) => (
          <span
            key={index}
            style={{ height: `${compact ? Math.round(height * 0.65) : height}px` }}
            className={cn(
              "min-w-px flex-1 rounded-[2px] transition-colors duration-75",
              index < litBars ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </span>

      <span
        className={cn(
          "shrink-0 tabular-nums text-muted-foreground",
          compact ? "text-[10.5px]" : "text-[11px]"
        )}
      >
        {errored ? "unavailable" : disabled ? "—" : clock(clipDuration - elapsed)}
      </span>

      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            const el = audioRef.current;
            if (el) el.currentTime = seekSec;
            setPlaying(false);
            setElapsed(0);
          }}
          onError={() => {
            setErrored(true);
            setPlaying(false);
          }}
        />
      ) : null}
    </div>
  );
}
