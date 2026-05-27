/**
 * `useQAComposer` — owns the chat input bar's control surface for
 * the non-recording phases (q_and_a, reviewing, welcome_back):
 *
 *   - `qaSubmitting` — composer locked while a /chat/query roundtrip
 *     is in flight. Exposed via setter so the labeling chain can
 *     lock the composer during its multi-bubble closer-out sequence
 *     (matrix C-LI-4 — no concurrent input during label resolution).
 *   - `showUploadUi` — per-turn paperclip flag (Rule G). Backend
 *     flips it true on upload-intent turns; we reset on the next
 *     non-intent turn or on upload completion.
 *   - `showRecordUi` — per-turn record-emphasis flag (Rule G). Peer
 *     of `showUploadUi` for mic affordance.
 *   - `uploadingFile` — gates the paperclip + composer while a
 *     file upload is in flight.
 *
 *   - `handleQASend` — the workhorse that POSTs to /chat/query.
 *     Wraps optimistic user-bubble + typing-bubble + replace-on-
 *     response. PRIVATE; only `handleComposerSubmit` (a 3-line
 *     adapter) is exposed.
 *   - `handleComposerSubmit` — `{text, audioBlob, durationSec}` →
 *     `handleQASend(...)`. Returned for ChatInputBar.
 *   - `handleQAFileUpload` — paperclip-picked-file handler. POSTs
 *     to /v2/user/uploads via `uploadUserFile`, lands a confirmation
 *     bubble, resets `showUploadUi` per Rule G.
 */
import { useCallback, useState } from "react";
import type { ThreadHandle } from "@/components/chat/thread/useThread";
import { botBubblesFromText } from "@/lib/chat/botBubbles";
import { postChatQuery } from "@/services/api/chatQuery";
import { getAuthToken } from "@/lib/api/auth-client";
import {
  GuestUploadFailure,
  USER_UPLOAD_MAX_BYTES,
  uploadUserFile,
} from "@/lib/api/public-client";

export interface UseQAComposerParams {
  activeSessionId: string | null;
  appendBubble: ThreadHandle["appendBubble"];
  replaceBubble: ThreadHandle["replaceBubble"];
}

export interface UseQAComposerReturn {
  qaSubmitting: boolean;
  /** Exposed so the labeling chain can lock the composer across
   *  its multi-bubble closer-out chain (matrix C-LI-4). */
  setQaSubmitting: (v: boolean) => void;
  showUploadUi: boolean;
  showRecordUi: boolean;
  uploadingFile: boolean;
  handleComposerSubmit: (args: {
    text: string;
    audioBlob: Blob | null;
    durationSec: number | null;
  }) => Promise<boolean>;
  handleQAFileUpload: (file: File) => Promise<void>;
}

export function useQAComposer({
  activeSessionId,
  appendBubble,
  replaceBubble,
}: UseQAComposerParams): UseQAComposerReturn {
  const [qaSubmitting, setQaSubmitting] = useState(false);
  /**
   * Per-turn upload-intent signal from /v2/chat/query (Rule G).
   * Backend flips this true when it detects "I want to upload / can
   * I upload / here is my file" intent in the user's question; flips
   * back to false on the next non-intent turn. Frontend uses it to
   * reveal the paperclip on the QAInput — default hidden so the
   * Q&A composer doesn't dangle an affordance the user can't act on
   * meaningfully unless the AI just suggested an upload.
   */
  const [showUploadUi, setShowUploadUi] = useState(false);
  /**
   * Per-turn record-intent signal from /v2/chat/query — peer of
   * showUploadUi. Backend flips true when it detects "can I just
   * record it here?" / "let me try it out loud" intent. Frontend
   * uses it to visually emphasise the always-present mic (a pulsing
   * primary-tint ring) so the user notices voice is an inviting
   * answer mode on this turn. The mic itself is unchanged — it
   * still POSTs multipart audio to /v2/chat/query for the casual
   * voice analytics path. Mutually exclusive with showUploadUi in
   * practice (backend won't return both true on the same turn);
   * both false is the neutral default.
   */
  const [showRecordUi, setShowRecordUi] = useState(false);
  /** True while a user-initiated file upload is in flight. Disables
   *  the QAInput composer + paperclip so the user can't double-fire. */
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleQASend = useCallback(
    async (
      question: string,
      audioBlob: Blob | null,
      durationSec: number | null
    ): Promise<boolean> => {
      // Re-entrant guard. Return false so ChatInputBar retains the
      // composer text — the user's input shouldn't disappear just
      // because they tapped Send twice fast.
      if (qaSubmitting) return false;
      // 1) optimistic user bubble, 2) typing placeholder that gets
      // 1:N replaced with the answer chunks on completion. Keeps the
      // thread auto-scrolled and avoids a separate floating indicator.
      appendBubble({ kind: "user_text", text: question });
      const typingId = appendBubble({ kind: "typing" });
      setQaSubmitting(true);
      try {
        // chatQuery service branches the wire format: multipart when
        // an audio blob is present (dual-capture turn, BE-3 will pull
        // out `audio_file` for silent acoustic metrics), JSON when
        // not — preserving the C1 contract for typed-only sends.
        const data = await postChatQuery({
          question,
          audioBlob,
          durationSec,
          sessionId: activeSessionId,
        });
        // Rule G — per-turn signal. Always read these off every
        // /chat/query response, even on errors, so the flags never
        // get stuck on after a transient failure.
        setShowUploadUi(data.show_upload_ui === true);
        setShowRecordUi(data.show_record_ui === true);
        if (data.answer) {
          // KB-sourced answer. Rule F clarifies: the Master-Doc
          // exemption is on COMPRESSION (backend must not shorten
          // grounded content to hit 75 chars), not on visual
          // segmentation. Long answers still get bubble-split at
          // natural boundaries for readability.
          replaceBubble(typingId, botBubblesFromText(data.answer));
          return true;
        }
        // Backend error envelope — first-party AI copy, follows
        // the 75-char rule like every other bot bubble. We return
        // false so ChatInputBar keeps the input + mic state for
        // the user to edit and retry (FE-10).
        const fallback =
          data.error ?? "Couldn't reach the coach. Try again in a moment.";
        replaceBubble(typingId, botBubblesFromText(fallback));
        return false;
      } catch {
        replaceBubble(
          typingId,
          botBubblesFromText("Couldn't reach the coach. Try again in a moment.")
        );
        // Network failure → both intent signals are stale data from
        // the previous turn. Reset to false so neither the paperclip
        // nor the record-emphasis pulse keep dangling after a fetch
        // error.
        setShowUploadUi(false);
        setShowRecordUi(false);
        return false;
      } finally {
        setQaSubmitting(false);
      }
    },
    [qaSubmitting, activeSessionId, appendBubble, replaceBubble]
  );

  /**
   * Single composer submit handler — forwards every submit to
   * /chat/query. The snippet-label followup chain no longer
   * intercepts composer submits (the closer-out auto-advance
   * replaced the "user replies to followup → bridge → next
   * snippet" pattern in PR #19). Returns handleQASend's boolean
   * so ChatInputBar can decide whether to clear the composer on
   * the FE-10 retry-on-error contract.
   */
  const handleComposerSubmit = useCallback(
    (args: {
      text: string;
      audioBlob: Blob | null;
      durationSec: number | null;
    }): Promise<boolean> =>
      handleQASend(args.text, args.audioBlob, args.durationSec),
    [handleQASend]
  );

  /**
   * Q&A file-upload handler — fires when the user picks a file via
   * the paperclip on QAInput (revealed only when the backend's last
   * /chat/query response carried `show_upload_ui: true`, Rule G).
   * On success/error, lands a one-line bot bubble in the thread so
   * the user has visible confirmation, and flips showUploadUi back
   * off so the paperclip hides until the next intent-signalled turn.
   */
  const handleQAFileUpload = useCallback(
    async (file: File) => {
      if (uploadingFile || qaSubmitting) return;
      const token = await getAuthToken();
      if (!token) {
        for (const b of botBubblesFromText(
          "Sign in to upload files — pre-recorded uploads need an account."
        )) {
          appendBubble(b);
        }
        return;
      }
      setUploadingFile(true);
      try {
        const result = await uploadUserFile(file, {
          sessionId: activeSessionId,
          authToken: token,
        });
        for (const b of botBubblesFromText(
          `File “${result.filename}” uploaded — your coach will review it.`
        )) {
          appendBubble(b);
        }
      } catch (err) {
        const message =
          err instanceof GuestUploadFailure
            ? err.code === "FILE_TOO_LARGE"
              ? `“${file.name}” is over the ${Math.round(
                  USER_UPLOAD_MAX_BYTES / 1024 / 1024
                )} MB limit.`
              : err.message
            : err instanceof Error
            ? err.message
            : "Couldn't upload the file.";
        for (const b of botBubblesFromText(
          `Couldn't upload “${file.name}” — ${message}`
        )) {
          appendBubble(b);
        }
      } finally {
        setUploadingFile(false);
        // Per Rule G, the upload-intent signal is per-turn — hide
        // the paperclip again until the next intent-signalled turn.
        setShowUploadUi(false);
      }
    },
    [activeSessionId, qaSubmitting, uploadingFile, appendBubble]
  );

  return {
    qaSubmitting,
    setQaSubmitting,
    showUploadUi,
    showRecordUi,
    uploadingFile,
    handleComposerSubmit,
    handleQAFileUpload,
  };
}
