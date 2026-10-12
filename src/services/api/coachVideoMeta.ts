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
