import type { ReadoutPayload } from "./readout";

/* -------------------------------------------------------------------------- */
/*  willabParked — the held, resumable Readout (§4 park-not-discard)           */
/*                                                                            */
/*  Diverging out of the Readout (close / "what do these mean?") PARKS the      */
/*  session: the processed recording is held and resumable, not discarded.      */
/*  Persisted to localStorage so it survives the overlay unmount AND a reload   */
/*  (the flow routes a returning user with a parked Readout straight to the      */
/*  parked state). Cleared on Send (it's no longer parked) — never on divert.   */
/* -------------------------------------------------------------------------- */

export interface ParkedReadout {
  sessionId: string | null; // the Lab upload's session_id (for send/re-read)
  topic: string;
  readout: ReadoutPayload;
}

const KEY = "willab.parked";

export function writeParked(p: ParkedReadout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode — park is best-effort */
  }
}

export function readParked(): ParkedReadout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ParkedReadout> | null;
    if (!p || !p.readout || !Array.isArray(p.readout.snippets)) return null;
    const r = p.readout as ReadoutPayload;
    return {
      sessionId: typeof p.sessionId === "string" ? p.sessionId : null,
      topic: typeof p.topic === "string" ? p.topic : "",
      // Default the per-deck-slide fields so a readout parked by an older app
      // version (before slides/slideTranscripts existed) doesn't crash
      // ReadoutCard's .length / iteration on resume. voiceMetricsAvailable
      // mirrors the mapper's rule (absent/undefined → true) so a readout parked
      // before that field existed doesn't show a spurious "unavailable" notice.
      readout: {
        ...r,
        slides: Array.isArray(r.slides) ? r.slides : [],
        slideTranscripts: Array.isArray(r.slideTranscripts)
          ? r.slideTranscripts
          : [],
        voiceMetricsAvailable: r.voiceMetricsAvailable !== false,
        // Absent/undefined → true (paid) so a readout parked before this field
        // existed doesn't misreport the arc's paid state on resume.
        auditPaid: r.auditPaid !== false,
      },
    };
  } catch {
    return null;
  }
}

export function clearParked(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* swallow */
  }
}

export function hasParkedReadout(): boolean {
  return readParked() !== null;
}
