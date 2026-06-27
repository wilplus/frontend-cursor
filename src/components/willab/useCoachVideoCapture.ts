"use client";

import { useRef, useState } from "react";
import {
  newUploadKey,
  readVideoDurationSec,
  videoProvenance,
  type CoachVideoMeta,
} from "@/services/api/coachVideoMeta";

/* -------------------------------------------------------------------------- */
/*  useCoachVideoCapture — Subsystem V upload state for a coach video slot.     */
/*                                                                            */
/*  Owns the idempotency-key semantics so the BE corpus never gets phantom      */
/*  takes: a NEW file selection mints a fresh key (a new record action / take); */
/*  a `retry()` after a failed upload re-sends the SAME file + SAME key (a      */
/*  network retry, deduped BE-side — not a new take). Provenance + duration are */
/*  gathered per upload (best-effort).                                          */
/* -------------------------------------------------------------------------- */

export interface CoachVideoCapture {
  uploading: boolean;
  error: string | null;
  /** True when the last upload failed and can be retried with the same key. */
  retryable: boolean;
  /** A fresh file selection / recording → new key (new take). */
  submit: (file: File) => void;
  /** Re-send the last failed file with the SAME key (deduped, never a new take). */
  retry: () => void;
}

export function useCoachVideoCapture(
  upload: (file: File, meta: CoachVideoMeta) => Promise<string | null>,
  /** Post-upload step (e.g. persist the returned ref). Return false (or throw)
   *  to signal it failed — the hook then KEEPS the key so retry() re-runs the
   *  whole action under the SAME key (the BE dedupes the re-upload, no phantom
   *  take). void / true / undefined → success. */
  onUploaded: (ref: string) => void | boolean | Promise<void | boolean>
): CoachVideoCapture {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The in-flight / last-failed record action — held so a retry reuses its key.
  const pendingRef = useRef<{ file: File; key: string } | null>(null);

  async function run(file: File, key: string) {
    pendingRef.current = { file, key };
    setUploading(true);
    setError(null);
    const prov = videoProvenance();
    const durationSec = await readVideoDurationSec(file);
    const ref = await upload(file, { idempotencyKey: key, durationSec, ...prov });
    if (!ref) {
      setUploading(false);
      setError("Upload failed. Try again.");
      return; // keep pendingRef so retry() reuses the same key
    }
    // The take exists BE-side now. Only clear the key once the WHOLE action —
    // including the post-upload save — succeeds; otherwise a new selection would
    // mint a new key and the BE would record a duplicate take.
    let finished: void | boolean;
    try {
      finished = await onUploaded(ref);
    } catch {
      finished = false;
    }
    setUploading(false);
    if (finished === false) {
      setError("Upload failed. Try again.");
      return; // keep pendingRef → retry() re-runs (deduped upload + re-save)
    }
    pendingRef.current = null;
  }

  return {
    uploading,
    error,
    retryable: !uploading && pendingRef.current !== null,
    submit: (file: File) => void run(file, newUploadKey()),
    retry: () => {
      const p = pendingRef.current;
      if (p && !uploading) void run(p.file, p.key);
    },
  };
}
