"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { claimPlayback, releasePlayback } from "@/lib/media/exclusivePlayback";
import { useRecoverableSrc } from "@/lib/media/mediaRefresh";

interface MediaPlayerProps {
  /** Resolved playable URL (R2 public or signed). */
  src: string | null;
  /** Where in the source file this snippet starts (ms). For concat'd
   *  full.webm files this is non-zero; for one-snippet-per-file rows
   *  it'll be 0. */
  startOffsetMs?: number;
  /** Slice length (ms). Drives the visible duration label and the
   *  hard pause-at-end clamp. */
  durationMs?: number;
  /** A slimmer row, for the judgement screen, where the answers — not the
   *  player — are the main thing (founder 2026-09-26). */
  compact?: boolean;
  /** Compact only: a small label above the waveform naming which recording
   *  this is ("Your practice · attempt 1", screen L1). */
  label?: string | null;
  /** Told when the <audio> errors (404, an expired signed URL, a decode
   *  failure), so a host holding a short-lived URL can ask for a fresh one.
   *  A new `src` clears the error state on its own. */
  onError?: () => void;
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
  src: rawSrc,
  startOffsetMs = 0,
  durationMs,
  compact = false,
  label = null,
  onError,
}: MediaPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // Position INSIDE the slice (audio.currentTime - seekSec).
  const [sliceCurrent, setSliceCurrent] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  // An <audio> `error` (404 / an expired signed link / decode failure) asks
  // the host once for a fresh link (useRecoverableSrc); `errored` is true
  // only when that did not help, and swaps in the small disabled state
  // instead of leaving a silent player.
  const { src, errored, recovering, handleError, handleLoaded } =
    useRecoverableSrc(rawSrc, onError);

  const seekSec = startOffsetMs / 1000;
  const clipDuration = typeof durationMs === "number" && durationMs > 0
    ? durationMs / 1000
    : mediaDuration;
  const clipEndSec = seekSec + clipDuration;

  // A new src is a new clip: nothing is playing it yet and its position
  // starts at the slice's start. (The error state is keyed by src.)
  useEffect(() => {
    setMediaDuration(0);
    setPlaying(false);
    setSliceCurrent(0);
  }, [src]);

  // Unmounting while playing must not leave this element as "the" player.
  useEffect(() => {
    const el = audioRef.current;
    return () => releasePlayback(el);
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
    handleLoaded();
    if (!(typeof durationMs === "number" && durationMs > 0)) {
      setMediaDuration(Number.isFinite(el.duration) ? el.duration : 0);
    }
    if (seekSec > 0) el.currentTime = seekSec;
  };

  const handlePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    // No known length (a streamed WebM reports Infinity): play to the
    // file's natural end, and resume where it was paused.
    if (el.currentTime < seekSec || (clipDuration > 0 && el.currentTime >= clipEndSec)) {
      el.currentTime = seekSec;
    }
    claimPlayback(el);
    setPlaying(true);
  };

  const handlePause = () => {
    releasePlayback(audioRef.current);
    setPlaying(false);
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    if (clipDuration > 0 && el.currentTime >= clipEndSec) {
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
  const disabled = !src || errored || recovering;
  const audio = src ? (
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
        setPlaying(false);
        handleError();
      }}
    />
  ) : null;

  if (compact) {
    return (
      <CompactRow
        label={label}
        playing={playing}
        disabled={disabled}
        onToggle={togglePlay}
        progress={clipDuration > 0 ? sliceCurrent / clipDuration : 0}
        clock={
          errored
            ? "audio unavailable"
            : playing
            ? fmtClock(sliceCurrent)
            : clipDuration > 0
            ? fmtClock(clipDuration)
            : null
        }
      >
        {audio}
      </CompactRow>
    );
  }

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
              : clipDuration > 0 ? fmtClock(clipDuration) : "…"}
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

      {audio}
    </div>
  );
}

const COMPACT_BARS = [
  5, 9, 6, 12, 8, 14, 7, 11, 5, 9, 13, 6, 10, 8, 12, 5, 9, 7, 11, 6, 10, 8,
];

/** The judgement screen's player (founder 2026-09-26, accepted screen L1):
 *  one row — the play button, a waveform that fills as it plays, and "Play
 *  this moment · 0:09" under it. Nothing to read; the answers below are the
 *  main thing on the screen. */
function CompactRow({
  label,
  playing,
  disabled,
  onToggle,
  progress,
  clock,
  children,
}: {
  label: string | null;
  playing: boolean;
  disabled: boolean;
  onToggle: () => void;
  progress: number;
  clock: string | null;
  children: ReactNode;
}) {
  const Icon = playing ? Pause : Play;
  const lit = Math.round(Math.min(1, Math.max(0, progress)) * COMPACT_BARS.length);
  return (
    <div
      data-compact-player
      className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2.5"
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={playing ? "Pause snippet" : "Play snippet"}
        aria-pressed={playing}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-primary-foreground",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <Icon
          aria-hidden
          className={cn("h-4 w-4 fill-current", !playing && "translate-x-[1px]")}
        />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {label ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
        ) : null}
        <div className="flex h-4 items-center gap-[3px]" aria-hidden>
          {COMPACT_BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-[2px] rounded-full",
                i < lit ? "bg-primary" : "bg-foreground/25",
              )}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          Play this moment{clock ? ` · ${clock}` : ""}
        </span>
      </div>
      {children}
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
