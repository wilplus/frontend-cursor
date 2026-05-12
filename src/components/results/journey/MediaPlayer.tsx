"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaPlayerProps {
  /** Optional real audio URL. When omitted, the player is decorative
   *  (button toggles state but no <audio> is rendered). */
  audioUrl?: string;
  /** Static duration label shown on the right of the track, e.g. "0:15". */
  duration: string;
}

/**
 * MediaPlayer — per the spec, this is a stylised audio player with:
 *   • a 40×40 round play/pause button (black bg, primary-foreground icon),
 *   • a 1.5-px progress track that fills to ~33 % when "playing",
 *   • a decorative 10-bar waveform (hidden on small screens).
 *
 * The track fill width is bound to real <audio> currentTime when an
 * audioUrl is provided, so users see actual progress while the clip
 * plays. Without a URL, it falls back to the 0 → 33 % fixed-state
 * behaviour described in the spec so the surface is still preview-able.
 */
export default function MediaPlayer({ audioUrl, duration }: MediaPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  // 0–1 progress. Driven by <audio> timeupdate when a URL is present;
  // pinned to 0.33 while "playing" (per spec) when not.
  const [progress, setProgress] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("0:00");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const dur = el.duration || 0;
      setProgress(dur > 0 ? Math.min(1, el.currentTime / dur) : 0);
      setCurrentLabel(formatClock(el.currentTime));
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentLabel("0:00");
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const toggle = () => {
    const el = audioRef.current;
    if (el) {
      if (isPlaying) {
        el.pause();
      } else {
        void el.play();
      }
      setIsPlaying(!isPlaying);
      return;
    }
    // No real audio: just toggle the visual state, pin progress per spec.
    setIsPlaying((v) => {
      const next = !v;
      setProgress(next ? 0.33 : 0);
      return next;
    });
  };

  const fillPct = `${Math.round(progress * 100)}%`;
  const Icon = isPlaying ? Pause : Play;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
      {/* Hidden <audio> drives real playback when a URL is supplied. */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          controlsList="nodownload"
        />
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Pause snippet" : "Play snippet"}
        aria-pressed={isPlaying}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-primary-foreground transition-transform hover:scale-105"
      >
        <Icon
          className={cn(
            "h-4 w-4 fill-current",
            // Optical centering nudge per spec — Play glyph has extra
            // negative space on the left so it visually drifts when
            // perfectly centred. Pause is symmetric and needs no nudge.
            !isPlaying && "translate-x-[1px]"
          )}
          aria-hidden
        />
      </button>

      {/* Track + time row */}
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: fillPct }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{currentLabel}</span>
          <span>{duration}</span>
        </div>
      </div>

      {/* Decorative waveform — 10 vertical bars with alternating heights.
          Purely visual; hidden below sm to keep the row compact on mobile. */}
      <div className="hidden items-end gap-0.5 sm:flex" aria-hidden>
        {WAVEFORM_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="w-0.5 rounded-full bg-foreground/30"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
    </div>
  );
}

/** 10-bar waveform pattern. Pre-baked alternating heights → no Math.random
 *  on every render (which would cause a visible flicker on rerender). */
const WAVEFORM_HEIGHTS = [10, 16, 8, 20, 12, 18, 6, 22, 10, 14];

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
