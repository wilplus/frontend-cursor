/**
 * processingTake — the persisted "analysis in progress" marker (delivery layer).
 *
 * The BE now accepts an upload with 202 and finishes `process_lab_recording`
 * in a background daemon, so the analysis SURVIVES a closed tab / locked
 * phone. This marker is written the moment a 202 lands and cleared when the
 * poll reaches a terminal state — so a user who left mid-analysis sees a calm
 * "still analyzing" indicator on return (the Lounge resumes the poll) instead
 * of a silently swallowed take.
 */

const KEY = "willab_processing_take";

export interface ProcessingTake {
  sessionId: string;
  arcId: string | null;
  /** 1-based take index within the batch; null for standalone recordings. */
  takeIndex: number | null;
  /** Epoch ms when the upload was accepted — drives the "taking longer" cap. */
  startedAt: number;
}

export function readProcessingTake(): ProcessingTake | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.sessionId !== "string" || v.sessionId.length === 0) return null;
    return {
      sessionId: v.sessionId,
      arcId: typeof v.arcId === "string" ? v.arcId : null,
      takeIndex: typeof v.takeIndex === "number" ? v.takeIndex : null,
      startedAt: typeof v.startedAt === "number" ? v.startedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeProcessingTake(t: ProcessingTake): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // storage quota — not fatal; the return-visit indicator just won't show
  }
}

export function clearProcessingTake(sessionId?: string): void {
  try {
    // Scoped clear: don't wipe a NEWER take's marker when an old poll lands.
    if (sessionId) {
      const cur = readProcessingTake();
      if (cur && cur.sessionId !== sessionId) return;
    }
    localStorage.removeItem(KEY);
  } catch {}
}
