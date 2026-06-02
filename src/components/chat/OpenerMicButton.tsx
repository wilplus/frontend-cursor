"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isDualCaptureSupported,
  useDualCaptureMic,
} from "@/hooks/useDualCaptureMic";

/* -------------------------------------------------------------------------- */
/*  OpenerMicButton — big-mic control for the T2 dad-joke opener              */
/*                                                                            */
/*  Unlike VoiceRecordButton (which uploads audio to /upload-answer), this    */
/*  captures the Web Speech transcript via dual-capture and hands it back as  */
/*  TEXT. The opener only needs the words for the LLM ack bridge — never the  */
/*  audio — so there's no upload and no Whisper round-trip.                   */
/*                                                                            */
/*  Keeps the bottom bar a single big mic from the joke straight through to   */
/*  onboarding (which is also a big mic). On browsers without Web Speech it   */
/*  degrades to a "Continue" button that sends an empty reply — the BE        */
/*  opener accepts user_reply:"" and just skips the ack (FE handoff Q3).      */
/* -------------------------------------------------------------------------- */

interface OpenerMicButtonProps {
  /** Fires with the spoken transcript (or "" when skipped / unsupported). */
  onReply: (text: string) => void;
  /** True while the parent's /opener/next call is in flight — locks the mic. */
  busy?: boolean;
}

export default function OpenerMicButton({
  onReply,
  busy = false,
}: OpenerMicButtonProps) {
  // Optimistic: assume support (the 95% case) so the mic shows first.
  // SSR + first client render both read `true`, so no hydration drift;
  // an unsupported browser corrects to the Continue button post-mount.
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    setSupported(isDualCaptureSupported());
  }, []);

  const mic = useDualCaptureMic();
  const recording = mic.state.status === "recording";

  // When the mic stops with a final transcript, hand it up and reset to
  // idle so the SAME button re-arms for the second joke reply (pivot).
  useEffect(() => {
    if (mic.state.status === "stopped") {
      onReply(mic.state.finalText.trim());
      mic.cancel();
    }
    // onReply is an inline parent closure; gating on status (the only
    // trigger) avoids re-firing on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.state.status]);

  const handleTap = useCallback(() => {
    if (busy) return;
    if (!supported) {
      onReply(""); // empty advances the joke
      return;
    }
    if (recording) void mic.stop();
    else void mic.start();
  }, [busy, supported, recording, mic, onReply]);

  if (!supported) {
    return (
      <div className="flex w-full flex-col items-center gap-2 pb-4 pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleTap}
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition disabled:opacity-50"
        >
          {busy ? "…" : "Continue"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Voice isn&apos;t supported here — tap to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2 pb-4 pt-2">
      <button
        type="button"
        disabled={busy}
        onClick={handleTap}
        aria-label={recording ? "Stop and send your reply" : "Tap to reply by voice"}
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-full transition",
          recording
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground",
          busy && "opacity-50"
        )}
      >
        {recording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />
        )}
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        ) : recording ? (
          <Square className="h-6 w-6" aria-hidden />
        ) : (
          <Mic className="h-7 w-7" aria-hidden />
        )}
      </button>
      <p className="text-[11px] text-muted-foreground">
        {busy ? "…" : recording ? "Tap to send" : "Tap and say anything"}
      </p>
    </div>
  );
}
