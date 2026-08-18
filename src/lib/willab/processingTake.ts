/**
 * processingTake — the persisted "analysis in progress" marker (delivery layer).
 *
 * The BE now accepts an upload with 202 and finishes `process_lab_recording`
 * in a background daemon, so the analysis SURVIVES a closed tab / locked
 * phone. This marker is written the moment a 202 lands. Success advances it
 * into document assembly; failure preserves it for manual retry against the
 * same stored audio. A user who leaves mid-analysis therefore returns to the
 * real job instead of a silently swallowed take.
 *
 * TWO PHASES (SPEC-lockin-loop §1, closing handoff §6.4 S3/S4). The readout
 * going terminal is NOT the text being ready: the arc-level ideal-text
 * reassembly lands at pipeline end, after `readout_ready`. Clearing there
 * opened a window where the blocking screen dropped and the PREVIOUS document
 * rendered as current — the founder's exact symptom. So the marker now names
 * which wait it is:
 *
 *   "analysis"  — the take itself is processing (the readout watch owns
 *                 clearing/transitioning this);
 *   "document"  — the readout is done, the document is assembling (the
 *                 settle probe owns clearing this, by observing the served
 *                 ideal text — lib/willab/documentSettle.ts).
 *
 * A marker with no phase is an "analysis" one written by an older tab.
 */

const KEY = "willab_processing_take";

function scopedKey(userId: string | null): string {
  return `${KEY}:${userId ?? "guest"}`;
}

export type ProcessingPhase = "analysis" | "document";
export type ProcessingStatus = "processing" | "failed";

export interface ProcessingTake {
  sessionId: string;
  arcId: string | null;
  /** 1-based take index within the batch; null for standalone recordings. */
  takeIndex: number | null;
  /** Epoch ms when the upload was accepted — drives the "taking longer" cap. */
  startedAt: number;
  /** Which wait this is. Older markers deserialize as "analysis". */
  phase: ProcessingPhase;
  /** A failed accepted recording remains addressable for manual retry. */
  status: ProcessingStatus;
  /** Epoch ms when the CURRENT phase began — the document-settle cap runs
   *  from here, not from the upload (a slow analysis must not eat the
   *  document phase's budget). */
  phaseStartedAt: number;
}

export function readProcessingTake(
  userId: string | null
): ProcessingTake | null {
  try {
    const raw = localStorage.getItem(scopedKey(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.sessionId !== "string" || v.sessionId.length === 0) return null;
    const startedAt =
      typeof v.startedAt === "number" ? v.startedAt : Date.now();
    return {
      sessionId: v.sessionId,
      arcId: typeof v.arcId === "string" ? v.arcId : null,
      takeIndex: typeof v.takeIndex === "number" ? v.takeIndex : null,
      startedAt,
      phase: v.phase === "document" ? "document" : "analysis",
      status: v.status === "failed" ? "failed" : "processing",
      phaseStartedAt:
        typeof v.phaseStartedAt === "number" ? v.phaseStartedAt : startedAt,
    };
  } catch {
    return null;
  }
}

export function writeProcessingTake(
  userId: string | null,
  t: Omit<ProcessingTake, "phase" | "phaseStartedAt" | "status"> &
    Partial<Pick<ProcessingTake, "phase" | "phaseStartedAt" | "status">>
): void {
  try {
    localStorage.setItem(
      scopedKey(userId),
      JSON.stringify({
        ...t,
        phase: t.phase ?? "analysis",
        status: t.status ?? "processing",
        phaseStartedAt: t.phaseStartedAt ?? t.startedAt,
      })
    );
  } catch {
    // storage quota — not fatal; the return-visit indicator just won't show
  }
}

/** Preserve the accepted recording and mark it as manually retryable. */
export function markProcessingTakeFailed(
  userId: string | null,
  sessionId: string
): void {
  try {
    const cur = readProcessingTake(userId);
    if (!cur || cur.sessionId !== sessionId) return;
    writeProcessingTake(userId, { ...cur, status: "failed" });
  } catch {}
}

/** The readout went terminal but the document is still assembling: move THIS
 *  session's marker into the "document" phase instead of clearing it. A
 *  different session's marker is left alone (same scoping rule as clear). */
export function transitionProcessingTakeToDocument(
  userId: string | null,
  sessionId: string
): void {
  try {
    const cur = readProcessingTake(userId);
    if (!cur || cur.sessionId !== sessionId) return;
    if (cur.phase === "document") return;
    writeProcessingTake(userId, {
      ...cur,
      phase: "document",
      phaseStartedAt: Date.now(),
    });
  } catch {}
}

export function clearProcessingTake(
  userId: string | null,
  sessionId?: string
): void {
  try {
    // Scoped clear: don't wipe a NEWER take's marker when an old poll lands.
    if (sessionId) {
      const cur = readProcessingTake(userId);
      if (cur && cur.sessionId !== sessionId) return;
    }
    localStorage.removeItem(scopedKey(userId));
  } catch {}
}
