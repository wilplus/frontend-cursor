"use client";

import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  MicButton — the canonical record-button presentation primitive            */
/*                                                                            */
/*  Pure UI: a 64x64 orange circle with a mic glyph at rest, a stop glyph    */
/*  + animate-pulse-ring while recording, and a `mm:ss` timer label below.  */
/*  The parent owns the MediaRecorder (or whatever capture mechanism it      */
/*  uses) and the bytes that come out — this component only renders the     */
/*  shared visual so the mic looks IDENTICAL across surfaces (onboarding,   */
/*  post-snippet reactions, trial recording, lounge chat).                  */
/*                                                                            */
/*  Single-slot UI rule: this component is ONE actionable element. Don't    */
/*  wrap a text input next to it; if voice is the answer mode, the slot     */
/*  is just this button.                                                     */
/* -------------------------------------------------------------------------- */

export interface MicButtonProps {
  /** True iff the parent's capture is currently running. Drives the
   *  pulse-ring + the icon swap to Square + the timer label colour. */
  recording: boolean;
  /** Elapsed seconds since recording started. Rendered as mm:ss.
   *  Parent ticks a setInterval; this component is presentational
   *  and trusts the value passed in. */
  seconds?: number;
  /** Disables tap + dims the button. Use while uploading the
   *  previous take, or when the chat is mid-network. */
  disabled?: boolean;
  /** Single click handler — tap-to-toggle. Parent decides what
   *  start / stop mean for its capture pipeline. */
  onTap: () => void;
  /** Override the resting-state hint label. Default: "Tap to speak". */
  idleLabel?: string;
  /** Override the recording-state hint label. Default: "Tap to stop". */
  recordingLabel?: string;
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MicButton({
  recording,
  seconds = 0,
  disabled = false,
  onTap,
  idleLabel = "Tap to speak",
  recordingLabel = "Tap to stop",
}: MicButtonProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          // Tactile feedback on supported devices. Best-effort —
          // browsers without the API just skip silently.
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try {
              navigator.vibrate?.(10);
            } catch {
              // ignore — some browsers throw on cross-origin iframes
            }
          }
          onTap();
        }}
        disabled={disabled}
        aria-label={recording ? "Stop recording" : "Start recording"}
        aria-pressed={recording}
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg transition-transform",
          "active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {recording && (
          <span
            className="absolute inset-0 rounded-full bg-primary animate-pulse-ring"
            aria-hidden
          />
        )}
        {recording ? (
          <Square className="relative z-10 h-5 w-5" aria-hidden />
        ) : (
          <Mic className="relative z-10 h-7 w-7" aria-hidden />
        )}
      </button>
      <span className="text-xs tabular-nums text-muted-foreground">
        {recording ? formatSeconds(seconds) : idleLabel}
      </span>
      {recording && (
        <span className="sr-only" role="status">
          {recordingLabel}
        </span>
      )}
    </div>
  );
}
