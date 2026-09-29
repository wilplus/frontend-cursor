/**
 * processingTake — the persisted "analysis in progress" marker (delivery layer).
 *
 * The BE now accepts an upload with 202 and finishes `process_lab_recording`
 * in a background daemon, so the analysis SURVIVES a closed tab / locked
 * phone. This marker is written the moment a 202 lands. Every spoken Take
 * advances into document settlement: Take 1 proves document creation; later
 * Takes prove their 2.0/3.0 review version while preserving the canonical
 * words. Failure preserves the marker for manual retry against the same stored
 * audio. A user who leaves mid-analysis therefore returns to the real job
 * instead of a swallowed take.
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
 *   "document"  — analysis is done and the Take's durable Ideal Text review
 *                 version is settling; the probe owns clearing it only after
 *                 observing that exact version.
 *
 * A marker with no phase is an "analysis" one written by an older tab.
 */

const KEY = "willab_processing_take";

function scopedKey(userId: string | null): string {
  return `${KEY}:${userId ?? "guest"}`;
}

export type ProcessingPhase = "analysis" | "document";
export type ProcessingStatus =
  | "processing"
  | "failed"
  | "failed_ideal_text_unconfirmed";

/** The latest real progress reported by the backend for this exact job. */
export interface ProcessingTakeProgress {
  stage: string;
  /** null means the backend exposes the phase but no honest percentage. */
  percent: number | null;
}

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
  /** Last backend-authored stage/percentage. Persisting it makes closing and
   *  reopening a presentation change only — the screen never jumps back to
   *  zero while the same job keeps running. */
  progress: ProcessingTakeProgress | null;
}

function parseProgress(v: unknown): ProcessingTakeProgress | null {
  if (!v || typeof v !== "object") return null;
  const raw = v as Record<string, unknown>;
  if (
    typeof raw.stage !== "string" ||
    raw.stage.length === 0 ||
    (raw.percent !== null &&
      (typeof raw.percent !== "number" || !Number.isFinite(raw.percent)))
  ) {
    return null;
  }
  return {
    stage: raw.stage,
    percent:
      raw.percent === null ? null : Math.max(0, Math.min(100, raw.percent)),
  };
}

export function readProcessingTake(
  userId: string | null,
): ProcessingTake | null {
  try {
    const raw = localStorage.getItem(scopedKey(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.sessionId !== "string" || v.sessionId.length === 0)
      return null;
    const startedAt =
      typeof v.startedAt === "number" ? v.startedAt : Date.now();
    return {
      sessionId: v.sessionId,
      arcId: typeof v.arcId === "string" ? v.arcId : null,
      takeIndex: typeof v.takeIndex === "number" ? v.takeIndex : null,
      startedAt,
      phase: v.phase === "document" ? "document" : "analysis",
      status:
        v.status === "failed_ideal_text_unconfirmed"
          ? "failed_ideal_text_unconfirmed"
          : v.status === "failed"
            ? "failed"
            : "processing",
      phaseStartedAt:
        typeof v.phaseStartedAt === "number" ? v.phaseStartedAt : startedAt,
      progress: parseProgress(v.progress),
    };
  } catch {
    return null;
  }
}

export function writeProcessingTake(
  userId: string | null,
  t: Omit<ProcessingTake, "phase" | "phaseStartedAt" | "status" | "progress"> &
    Partial<
      Pick<ProcessingTake, "phase" | "phaseStartedAt" | "status" | "progress">
    >,
): void {
  try {
    localStorage.setItem(
      scopedKey(userId),
      JSON.stringify({
        ...t,
        phase: t.phase ?? "analysis",
        status: t.status ?? "processing",
        phaseStartedAt: t.phaseStartedAt ?? t.startedAt,
        progress: parseProgress(t.progress),
      }),
    );
  } catch {
    // storage quota — not fatal; the return-visit indicator just won't show
  }
}

/** Update progress only when the marker still belongs to this session. A late
 *  callback from job A can therefore never repaint a newer job B. */
export function updateProcessingTakeProgress(
  userId: string | null,
  sessionId: string,
  progress: ProcessingTakeProgress,
): ProcessingTakeProgress | null {
  try {
    const cur = readProcessingTake(userId);
    if (!cur || cur.sessionId !== sessionId) return null;
    const next = parseProgress(progress);
    if (!next) return cur.progress;
    // The immediate fetch and SSE can resolve out of order. Progress is a
    // monotonic fact for one accepted job, so an older envelope must not make
    // either storage or the open screen move backwards.
    if (
      cur.progress &&
      (cur.progress.stage === "completed" ||
        cur.progress.percent === null ||
        (next.percent !== null && next.percent < cur.progress.percent))
    ) {
      return cur.progress;
    }
    writeProcessingTake(userId, { ...cur, progress: next });
    return next;
  } catch {
    return null;
  }
}

/** Preserve the accepted recording and mark it as manually retryable. */
export function markProcessingTakeFailed(
  userId: string | null,
  sessionId: string,
): void {
  try {
    const cur = readProcessingTake(userId);
    if (!cur || cur.sessionId !== sessionId) return;
    writeProcessingTake(userId, { ...cur, status: "failed" });
  } catch {}
}

/** Take 1 analysis finished, but its required document never became explicit
 *  in the database. This is a distinct terminal state: the preserved retry
 *  regenerates only Ideal Text from stored analysis artifacts. */
export function markProcessingTakeIdealTextUnconfirmed(
  userId: string | null,
  sessionId: string,
): void {
  try {
    const cur = readProcessingTake(userId);
    if (!cur || cur.sessionId !== sessionId) return;
    writeProcessingTake(userId, {
      ...cur,
      status: "failed_ideal_text_unconfirmed",
    });
  } catch {}
}

/** The readout went terminal but the document is still assembling: move THIS
 *  session's marker into the "document" phase instead of clearing it. A
 *  different session's marker is left alone (same scoping rule as clear). */
export function transitionProcessingTakeToDocument(
  userId: string | null,
  sessionId: string,
): void {
  try {
    const cur = readProcessingTake(userId);
    if (!cur || cur.sessionId !== sessionId) return;
    if (cur.phase === "document") return;
    writeProcessingTake(userId, {
      ...cur,
      phase: "document",
      phaseStartedAt: Date.now(),
      // Document assembly is a real phase, but its endpoint exposes no
      // percentage. Persist that truth explicitly instead of showing 100%
      // while the user is still waiting.
      progress: { stage: "document_assembly", percent: null },
    });
  } catch {}
}

export function clearProcessingTake(
  userId: string | null,
  sessionId?: string,
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
