"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import VoiceRecordButton from "@/components/funnel/VoiceRecordButton";

/* -------------------------------------------------------------------------- */
/*  RecordingReadyPanel — post-labeling recording surface                    */
/*                                                                            */
/*  Wraps the canonical big-mic component (`VoiceRecordButton` — same       */
/*  visual the onboarding funnel uses) and routes the multipart upload to   */
/*  `/api/v2/user/chat/upload-answer` with `source_snippet_id` set to the   */
/*  just-labeled snippet. Different upload target from onboarding's         */
/*  `/api/v2/coaching/trial-recording`; same UI, same recorder engine.      */
/*                                                                            */
/*  Three terminal outcomes:                                                  */
/*    (a) success → parent appends "Your coach is reviewing…" bubble +      */
/*        clears recordingReady; deriveToolbar transitions to `none` until  */
/*        the next admin publish (via realtime / polling).                  */
/*    (b) 409 PRIOR_SESSION_PENDING_REVIEW (B2 gate) → toast + mic         */
/*        permanently disabled this mount; user must navigate away + back   */
/*        for the gate to re-evaluate.                                      */
/*    (c) other failure → toast, mic re-enables for retry.                  */
/* -------------------------------------------------------------------------- */

export interface RecordingReadyPanelProps {
  /** The snippet whose closer chain produced this recording-ready
   *  state. Forwarded to the BE as `source_snippet_id` so the
   *  upload attaches to the right context for coaching review. */
  snippetId: string;
  /**
   * Fires on 200 from upload-answer. Parent should:
   *   - append the "Your coach is reviewing…" bubble
   *   - clear `recordingReady` (panel transitions to `none`)
   *   - leave the closed-out set alone — the snippet stays closed-out
   *     so re-entry doesn't replay the labeling chain.
   */
  onUploadComplete: () => void;
  /** Optimistic feedback hook — fires the moment recording stops,
   *  BEFORE the upload completes. Parent typically appends a
   *  user_audio bubble with the playable Object URL so the user
   *  sees their take in the thread immediately. */
  onRecordingCaptured?: (audioUrl: string, durationSeconds: number) => void;
}

export function RecordingReadyPanel({
  snippetId,
  onUploadComplete,
  onRecordingCaptured,
}: RecordingReadyPanelProps) {
  // `b2Locked` is the B2-gate latch — once a 409 PRIOR_SESSION_PENDING_
  // REVIEW lands the mic stays disabled for the lifetime of this mount
  // per matrix C4. The user has to navigate away + back to retry, which
  // forces the BE to re-check whether the prior session is still under
  // review.
  const [b2Locked, setB2Locked] = useState(false);
  // Upload-in-flight flag. Disables the mic between stop and the
  // upload's resolution so a fast double-tap can't fire a second
  // recording while the first is mid-flight.
  const [uploading, setUploading] = useState(false);

  const handleSend = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("audio_file", blob, "recording.webm");
        form.append("source_snippet_id", snippetId);
        form.append("intent", "post_labeling_continuation");
        form.append("audio_duration_sec", String(durationSeconds));

        const res = await fetch("/api/v2/user/chat/upload-answer", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
        };
        if (!res.ok) {
          if (data.code === "PRIOR_SESSION_PENDING_REVIEW") {
            setB2Locked(true);
            toast.error(
              "Your coach is still reviewing a prior session. Try again when they've finished."
            );
            return;
          }
          toast.error(data.error ?? "Couldn't upload — try again.");
          return;
        }
        onUploadComplete();
      } catch (err) {
        console.warn("upload-answer POST failed:", err);
        toast.error("Couldn't reach the upload service. Try again.");
      } finally {
        setUploading(false);
      }
    },
    [snippetId, onUploadComplete]
  );

  return (
    <div className="flex flex-col items-center gap-2 pb-6 pt-2">
      <VoiceRecordButton
        onSend={handleSend}
        onRecorded={onRecordingCaptured}
        disabled={b2Locked || uploading}
      />
      <p className="text-xs text-muted-foreground">
        {b2Locked
          ? "Coach is reviewing your previous session — come back soon."
          : uploading
          ? "Uploading…"
          : "Tap to record a fresh take"}
      </p>
    </div>
  );
}
