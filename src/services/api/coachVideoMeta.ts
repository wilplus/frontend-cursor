/* -------------------------------------------------------------------------- */
/*  coachVideoMeta — Subsystem V capture contract (FE side)                    */
/*                                                                            */
/*  Every coach video upload carries an idempotency key and best-effort         */
/*  provenance, so the BE can build a training                                 */
/*  corpus that tells a retry (dedupe) from a genuine re-record (a new take +   */
/*  a preference pair). The key semantics are owned by the caller:             */
/*    - ONE key per record action (a fresh file selection / recording)         */
/*    - REUSE the same key when retrying a FAILED upload of that same file     */
/*    - NEW key for a deliberate re-record                                     */
/*  (see useCoachVideoCapture).                                                 */
/* -------------------------------------------------------------------------- */

export interface CoachVideoMeta {
  /** Client-generated UUID; dedupes a retried upload of the SAME record action. */
  idempotencyKey: string;
  /** Best-effort provenance (BE can't recover these later, so we send them). */
  device: string | null;
  source: string | null;
  /** Recorded length in seconds; null → BE backfills from the file (ffprobe). */
  durationSec: number | null;
}

/** A fresh idempotency key for a new record action. */
export function newUploadKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/** Platform + app/browser, best-effort. device/source can't be recovered BE-side.
 *  `sourceOverride` (FP-2) lets an in-app recording tag itself as
 *  "in-app-recording" so the BE can tell a camera capture from a file upload;
 *  the browser UA still rides along on `device`. */
export function videoProvenance(sourceOverride?: string): {
  device: string | null;
  source: string | null;
} {
  if (typeof navigator === "undefined") {
    return { device: null, source: sourceOverride ?? null };
  }
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const device = nav.userAgentData?.platform || nav.platform || null;
  const ua = nav.userAgent || "";
  const source = sourceOverride ?? (ua ? `willab-web ${ua}` : "willab-web");
  return { device: device || null, source };
}

/** Read a video file's duration (seconds) via a throwaway <video> element.
 *  Best-effort + bounded: resolves null on any failure so it never blocks the
 *  upload (the BE backfills duration from the file). */
export function readVideoDurationSec(file: File): Promise<number | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    let url: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Single exit: revoke the object URL + clear the timer on EVERY path
    // (metadata, error, timeout, catch) so a slow/undecodable file can't leak.
    const done = (v: number | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
      resolve(v);
    };
    try {
      url = URL.createObjectURL(file);
      const el = document.createElement("video");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        const d = el.duration;
        done(Number.isFinite(d) && d > 0 ? Math.round(d) : null);
      };
      el.onerror = () => done(null);
      el.src = url;
      // Never block the upload on metadata.
      timer = setTimeout(() => done(null), 4000);
    } catch {
      done(null);
    }
  });
}
