/**
 * `useRecordingHandoff` — owns the two pieces of state that drive
 * the post-labeling recording surface AND the post-upload idle
 * window:
 *
 *   - `recordingReadyForSnippetId` — when non-null, the bottom
 *     toolbar swaps from composer to the big `RecordingReadyPanel`.
 *     Set by the labeling chain's `continueAfterFollowup` once the
 *     closer-out sequence (label → followup → thanks → intro) has
 *     landed; cleared on successful multipart upload (when
 *     `awaitingAdminReview` takes over) or when the user navigates
 *     to a recording phase.
 *
 *   - `awaitingAdminReview` — true between a successful upload and
 *     the next admin publish landing in the thread. Renders no
 *     toolbar — the user waits, no chat. Cleared the moment a
 *     fresh `action_pending` bubble is revealed (`deriveToolbar`'s
 *     `label_buttons` branch wins before this even gets read, but
 *     we still flip the flag for code clarity).
 *
 * Both setters are returned so the labeling chain (which sets
 * `recordingReadyForSnippetId` after the intro bubble lands, and
 * flips `awaitingAdminReview` after the upload completes via the
 * panel's `onUploadComplete` callback) can drive them.
 *
 * The two panel callbacks (`onRecordingCaptured`, `onUploadComplete`)
 * also live here as `useCallback`s so the JSX in `page.client.tsx`
 * is a trivially clean `<RecordingReadyPanel … />` — no inline
 * arrow functions that re-allocate on every render.
 */
import { useCallback, useState } from "react";
import type { ThreadHandle } from "@/components/chat/thread/useThread";
import { botBubblesFromText } from "@/lib/chat/botBubbles";

const POST_UPLOAD_COACH_REVIEW_BUBBLE =
  "Got it. Your coach is reviewing your new recording — you'll see the results when they're done.";

export interface UseRecordingHandoffParams {
  appendBubble: ThreadHandle["appendBubble"];
}

export interface UseRecordingHandoffReturn {
  recordingReadyForSnippetId: string | null;
  setRecordingReadyForSnippetId: (id: string | null) => void;
  awaitingAdminReview: boolean;
  setAwaitingAdminReview: (v: boolean) => void;
  /** Fires the moment recording stops (before upload completes).
   *  Appends an optimistic `user_audio` bubble so the user sees
   *  their take in the thread without waiting for the upload
   *  roundtrip. */
  onRecordingCaptured: (audioUrl: string, durationSeconds: number) => void;
  /** Fires on 200 from `/api/v2/user/chat/upload-answer`. Appends
   *  the "coach is reviewing" bubble, clears the recording-ready
   *  state, and flips into `awaitingAdminReview`. */
  onUploadComplete: () => void;
}

export function useRecordingHandoff({
  appendBubble,
}: UseRecordingHandoffParams): UseRecordingHandoffReturn {
  const [recordingReadyForSnippetId, setRecordingReadyForSnippetId] =
    useState<string | null>(null);
  const [awaitingAdminReview, setAwaitingAdminReview] = useState(false);

  const onRecordingCaptured = useCallback(
    (audioUrl: string, durationSeconds: number) => {
      appendBubble({
        kind: "user_audio",
        audioUrl,
        duration: `${Math.floor(durationSeconds / 60)}:${String(
          Math.floor(durationSeconds % 60)
        ).padStart(2, "0")}`,
      });
    },
    [appendBubble]
  );

  const onUploadComplete = useCallback(() => {
    for (const b of botBubblesFromText(POST_UPLOAD_COACH_REVIEW_BUBBLE)) {
      appendBubble(b);
    }
    setRecordingReadyForSnippetId(null);
    setAwaitingAdminReview(true);
  }, [appendBubble]);

  return {
    recordingReadyForSnippetId,
    setRecordingReadyForSnippetId,
    awaitingAdminReview,
    setAwaitingAdminReview,
    onRecordingCaptured,
    onUploadComplete,
  };
}
