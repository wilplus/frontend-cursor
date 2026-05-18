"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  TrialRecordingBubble — STEP 9 of the snippet-review state machine        */
/*                                                                            */
/*  Renders inside the chat thread when                                       */
/*  `triggers: ["show_trial_recording_mic"]` lands on the state-machine     */
/*  turn response. Shows the AI's prompt copy in a bot bubble + a single    */
/*  big circular record button below it. Tap → record → on stop the audio  */
/*  is POSTed multipart to /api/coaching/trial-recording with the          */
/*  coaching_id from the state-machine payload. New snippets land on       */
/*  /results once the backend pipeline finishes.                            */
/*                                                                            */
/*  Single-actionable surface: the parent should disable its text composer */
/*  while this bubble is the active prompt (use the optional onActiveChange*/
/*  callback to track active = !submitted && !error-locked).                */
/*                                                                            */
/*  Errors                                                                    */
/*  ------                                                                   */
/*  • 409 PRIOR_SESSION_PENDING_REVIEW — render the polite decline message */
/*    inline, lock the button, do NOT retry.                                */
/*  • Any other failure — toast + re-arm the button so the user can retry. */
/* -------------------------------------------------------------------------- */

/** Hard cap so the user can't accidentally record forever. */
const MAX_RECORD_MS = 60_000;

export interface TrialRecordingBubbleProps {
  /** Coaching session id — comes from the state-machine turn's
   *  trial_recording.coaching_id. */
  coachingId: string;
  /** AI-generated prompt copy — shown above the record button. */
  promptText: string;
  /**
   * Fires whenever the bubble's "active" state changes. The bubble
   * is active from mount until it reaches a terminal state (success
   * or PRIOR_SESSION_PENDING_REVIEW lock). The parent should keep
   * its text composer disabled while active is true, the same way
   * STEP 8's acoustic-targets card is gated.
   */
  onActiveChange?: (active: boolean) => void;
  /** Fires once on a successful 2xx upload. Parent can use this to
   *  advance the state machine, toast, or trigger a /results route. */
  onSuccess?: (response: {
    trial_session_id?: string;
    recording_id?: string;
  }) => void;
}

type Phase =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "uploading" }
  | { kind: "success" }
  /** Backend declined because another snippet review is still
   *  pending — server message is rendered verbatim. */
  | { kind: "locked"; message: string };

export function TrialRecordingBubble({
  coachingId,
  promptText,
  onActiveChange,
  onSuccess,
}: TrialRecordingBubbleProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const unmountedRef = useRef(false);

  // The parent listens to this to gate its text composer. Active iff
  // we have not yet reached a terminal phase (success or locked).
  useEffect(() => {
    if (!onActiveChange) return;
    const terminal = phase.kind === "success" || phase.kind === "locked";
    onActiveChange(!terminal);
  }, [phase.kind, onActiveChange]);

  // Tear down the mic stream + timers on unmount so we never strand
  // the OS recording indicator on a navigation.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (recordTimeoutRef.current) clearTimeout(recordTimeoutRef.current);
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // best-effort
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    if (phase.kind !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (unmountedRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        await upload(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setPhase({ kind: "recording", startedAt: Date.now() });
      recordTimeoutRef.current = setTimeout(stopRecording, MAX_RECORD_MS);
    } catch (err) {
      console.error("trial recording — getUserMedia failed:", err);
      toast.error("Microphone permission denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (recordTimeoutRef.current) {
      clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    // Phase flips to "uploading" inside upload() once we have the blob.
  };

  const upload = async (audioBlob: Blob) => {
    setPhase({ kind: "uploading" });
    try {
      const fd = new FormData();
      fd.append("coaching_id", coachingId);
      fd.append("audio_file", audioBlob, "trial.webm");
      const res = await fetch("/api/coaching/trial-recording", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        code?: string;
        error?: string;
        trial_session_id?: string;
        recording_id?: string;
      };
      if (unmountedRef.current) return;

      // Backend's polite decline when another session is still in
      // review. Don't retry — lock the button and surface the copy.
      if (res.status === 409 || data.code === "PRIOR_SESSION_PENDING_REVIEW") {
        setPhase({
          kind: "locked",
          message:
            data.error ||
            "We're still reviewing your last recording — try again once your coach publishes the snippets.",
        });
        return;
      }

      if (!res.ok || data.status !== "ok") {
        toast.error(data.error ?? "Couldn't process your recording.");
        setPhase({ kind: "idle" });
        return;
      }

      toast.success(
        "Got it — your coach will analyse this, new snippets will appear on /results."
      );
      setPhase({ kind: "success" });
      onSuccess?.({
        trial_session_id: data.trial_session_id,
        recording_id: data.recording_id,
      });
    } catch (err) {
      if (unmountedRef.current) return;
      console.error("trial recording — upload failed:", err);
      toast.error("Network error. Please try again.");
      setPhase({ kind: "idle" });
    }
  };

  const handleClick = () => {
    if (phase.kind === "idle") return void startRecording();
    if (phase.kind === "recording") return stopRecording();
    // uploading / success / locked are all click-inert.
  };

  const isRecording = phase.kind === "recording";
  const isUploading = phase.kind === "uploading";
  const isLocked = phase.kind === "locked";
  const isSuccess = phase.kind === "success";
  const isDone = isLocked || isSuccess;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="flex max-w-[92%] items-start gap-2.5 sm:max-w-[85%]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <span className="text-xs font-bold text-primary-foreground">W</span>
        </div>
        <div className="w-full rounded-2xl rounded-tl-sm border border-border bg-chat-bot px-4 py-3 shadow-sm">
          <p className="text-[13px] leading-relaxed text-foreground">
            {promptText}
          </p>

          {isLocked && phase.kind === "locked" && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              {phase.message}
            </p>
          )}

          {isSuccess && (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800">
              Got it — your coach will analyse this. New snippets will appear
              on your results when they&apos;re ready.
            </p>
          )}

          {!isDone && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button
                type="button"
                onClick={handleClick}
                disabled={isUploading}
                aria-label={
                  isRecording
                    ? "Stop recording"
                    : isUploading
                    ? "Uploading…"
                    : "Start recording"
                }
                aria-pressed={isRecording}
                className={cn(
                  "h-16 w-16 shrink-0 rounded-full p-0 transition-all",
                  isRecording &&
                    "animate-pulse bg-destructive hover:bg-destructive/90",
                  isUploading && "opacity-60"
                )}
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                ) : isRecording ? (
                  <Square className="h-6 w-6" aria-hidden />
                ) : (
                  <Mic className="h-6 w-6" aria-hidden />
                )}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {isRecording
                  ? "Tap to stop"
                  : isUploading
                  ? "Sending…"
                  : "Tap to record"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
