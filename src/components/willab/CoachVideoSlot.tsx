"use client";

import { useRef } from "react";
import { Loader2, Video, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCoachVideo } from "@/services/api/coachReview";
import { useCoachVideoCapture } from "./useCoachVideoCapture";

/* -------------------------------------------------------------------------- */
/*  CoachVideoSlot — session-level coach video upload (§F.6)                   */
/*                                                                            */
/*  Thin pass-through to the BE upload endpoint. On mobile, the input uses     */
/*  `capture="environment"` which prompts iOS Safari / Android Chrome to       */
/*  open the rear camera straight into a recording UI — matching the user's    */
/*  "upload or redirect to the phone camera" ask. Desktop just gets the file   */
/*  picker, which accepts pre-recorded clips.                                  */
/*                                                                            */
/*  Replace semantics (§S.6 "Latest upload replaces"): every new upload        */
/*  overwrites the previous video_ref. No transcoding, no thumbnails — that's */
/*  the deferred "full video feature" out of scope for this PR.                */
/* -------------------------------------------------------------------------- */

export default function CoachVideoSlot({
  sessionId,
  videoRef,
  onUploaded,
}: {
  sessionId: string;
  /** Current persisted video URL; null when nothing has been uploaded yet. */
  videoRef: string | null;
  /** Fires on successful upload; parent updates CoachReviewSession.videoRef
   *  locally so the preview shows immediately without a session refetch. */
  onUploaded: (nextRef: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Subsystem V: idempotency key + provenance are owned by the hook so a retry
  // dedupes and a re-record is a new take.
  const cap = useCoachVideoCapture(
    (file, meta) => uploadCoachVideo(sessionId, file, meta),
    onUploaded
  );
  const uploading = cap.uploading;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">
        Coach video
        <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
          Shown to user · optional
        </span>
      </p>

      {videoRef ? (
        <div className="mt-3 space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={videoRef}
            controls
            playsInline
            className="w-full rounded-xl bg-black"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full"
          >
            <Video className="mr-1.5 h-4 w-4" aria-hidden />
            {uploading ? "Replacing…" : "Replace video"}
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full"
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Video className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            {uploading ? "Uploading…" : "Upload coach video"}
          </Button>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Tap to choose a file or record one straight from your phone&apos;s camera.
          </p>
        </div>
      )}

      {cap.error ? (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-destructive">
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{cap.error}</span>
          {cap.retryable ? (
            <button
              type="button"
              onClick={cap.retry}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Hidden input — `capture="environment"` triggers the rear phone
          camera on mobile; desktop falls back to the standard file picker. */}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // A new selection is a new record action → new idempotency key.
          if (file) cap.submit(file);
          // Reset so picking the same file twice still fires onChange.
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}
