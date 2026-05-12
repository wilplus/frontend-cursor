"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaPlayerProps {
  /** Resolved playable URL (R2 public or signed). */
  src: string | null;
  /** Where in the source file this snippet starts (ms). For concat'd
   *  full.webm files this is non-zero; for one-snippet-per-file rows
   *  it'll be 0. */
  startOffsetMs: number;
  /** Slice length (ms). Drives the visible duration label and the
   *  hard pause-at-end clamp. */
  durationMs: number;
}

/**
 * MediaPlayer — Voice-Journey snippet player with playback clamping.
 *
 * Visuals (per spec):
 *   • 40×40 round play/pause button (bg-foreground, primary-foreground icon),
 *   • 1.5px progress track that fills 0 → 100 % across the SLICE
 *     (not the underlying file),
 *   • current-time / duration labels in tabular-nums under the track,
 *   • decorative 10-bar waveform (hidden on small screens).
 *
 * Clamping (so concat'd full.webm files only play the user's snippet):
 *   • on `loadedmetadata`: if startOffsetMs > 0, currentTime = seekSec.
 *   • on `play`: if currentTime is outside [seekSec, clipEndSec],
 *     reset to seekSec before letting the browser play.
 *   • on `timeupdate`: if currentTime ≥ clipEndSec, pause + reset to
 *     seekSec so the next press of play starts the slice over.
 *
 * Pattern lifted verbatim from
 * src/app/admin/users/[userId]/page.tsx::SnippetPreviewPlayer.
 */
export default function MediaPlayer({
  src,
  startOffsetMs,
  durationMs,
}: MediaPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // Position INSIDE the slice (audio.currentTime - seekSec).
  const [sliceCurrent, setSliceCurrent] = useState(0);
  // True once <audio> emits an `error` (404 / decode failure). We swap
  // in a small disabled state instead of leaving a silent player.
  const [errored, setErrored] = useState(false);

  const seekSec = startOffsetMs / 1000;
  const clipDuration = durationMs / 1000;
  const clipEndSec = seekSec + clipDuration;

  // Reset error flag when src changes — re-fetched URLs deserve a retry.
  useEffect(() => {
    setErrored(false);
  }, [src]);

  // Pre-position the playhead whenever boundaries change so press-play
  // picks up at the right spot without a UI jump.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !el.paused) return;
    if (el.currentTime !== seekSec) el.currentTime = seekSec;
  }, [seekSec]);

  const handleLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    if (seekSec > 0) el.currentTime = seekSec;
  };

  const handlePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.currentTime < seekSec || el.currentTime >= clipEndSec) {
      el.currentTime = seekSec;
    }
    setPlaying(true);
  };

  const handlePause = () => setPlaying(false);

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.currentTime >= clipEndSec) {
      el.pause();
      el.currentTime = seekSec;
      setPlaying(false);
      setSliceCurrent(0);
      return;
    }
    setSliceCurrent(Math.max(0, el.currentTime - seekSec));
  };

  const handleEnded = () => {
    const el = audioRef.current;
    if (el) el.currentTime = seekSec;
    setPlaying(false);
    setSliceCurrent(0);
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || errored || !src) return;
    if (playing) {
      el.pause();
    } else {
      void el.play().catch(() => {
        // Browser blocked playback (autoplay policy etc.) — surface
        // through onError handling so the UI doesn't pretend it's
        // playing when it isn't.
        setPlaying(false);
      });
    }
  };

  const Icon = playing ? Pause : Play;
  const fillPct =
    clipDuration > 0
      ? `${Math.min(100, Math.max(0, (sliceCurrent / clipDuration) * 100))}%`
      : "0%";

  // No audio at all — render the player surface but with the play
  // button visually disabled. Keeps the row height stable so the page
  // doesn't reflow when audio_url is null.
  const disabled = !src || errored;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={playing ? "Pause snippet" : "Play snippet"}
        aria-pressed={playing}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-primary-foreground transition-transform hover:scale-105",
          disabled && "cursor-not-allowed opacity-50 hover:scale-100"
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            "h-4 w-4 fill-current",
            // Optical centering: the Play glyph has more negative space
            // on its right edge so it drifts left when perfectly
            // centred. Pause is symmetric and needs no nudge.
            !playing && "translate-x-[1px]"
          )}
        />
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: fillPct }}
          />
        </div>
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{fmtClock(sliceCurrent)}</span>
          <span>
            {errored
              ? "audio unavailable"
              : disabled
              ? "—"
              : fmtClock(clipDuration)}
          </span>
        </div>
      </div>

      {/* Decorative waveform — purely visual, hidden < sm to keep the
          row tight on mobile. Pre-baked alternating heights so a
          rerender doesn't reshuffle the bars. */}
      <div className="hidden h-6 items-end gap-0.5 sm:flex" aria-hidden>
        {WAVEFORM_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="w-0.5 rounded-full bg-foreground/30"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>

      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={() => {
            setErrored(true);
            setPlaying(false);
          }}
        />
      )}
    </div>
  );
}

const WAVEFORM_HEIGHTS = [6, 12, 8, 16, 10, 14, 8, 12, 6, 10];

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
