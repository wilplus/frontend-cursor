/* -------------------------------------------------------------------------- */
/*  THE SPEAKING ERROR LIBRARY — the coach's client                            */
/*                                                                            */
/*  Founder: "that is our goal to have the library of the errors so we can     */
/*  recognise them and we have the exercise matching algorithm and they should */
/*  go hand in hand."                                                          */
/*                                                                            */
/*  `status` is the seam this whole surface is built around:                   */
/*                                                                            */
/*    observed — a human named the pattern and wrote down what it is. No code  */
/*               can find it yet. This is the engineering backlog.             */
/*    detected — code can find it in audio. ONLY these route exercises.        */
/*    shadow   — a detector is being tested silently (backend 2026-09-28, D3). */
/*               It routes nothing yet, and the form cannot edit it.           */
/*                                                                            */
/*  A coach writes `observed` and nothing else. Marking one detected needs a   */
/*  detector in code, so it is set by the migration that adds one — never by   */
/*  a form. The backend refuses the claim either way; this module simply does  */
/*  not offer it.                                                             */
/* -------------------------------------------------------------------------- */

import { coachReadError, messageCall, type MessageResult } from "@/lib/api/bffCall";

export type SpeakingErrorStatus = "observed" | "detected" | "shadow";

export interface SpeakingError {
  errorId: string;
  label: string;
  /** What is measured, in terms a detector could be written or checked
   *  against. Not a description of the fix. */
  definition: string;
  /** The single question this state answers. One thing, never two. */
  asks: string;
  status: SpeakingErrorStatus;
  /** The signal name(s) that detect it. Present only for `detected`. */
  detectorRef: string | null;
  observedBy: string | null;
  active: boolean;
}

/** A failure's `code` distinguishes a rewordable refusal (INVALID_INPUT) from
 *  ALREADY_DETECTED, which is not a mistake the author can fix by editing
 *  the form — it means the entry is load-bearing and must be left alone. */
export type LibraryResult<T> = MessageResult<T>;

/** A new entry, as the form collects it. `status` is deliberately absent. */
export interface SpeakingErrorDraft {
  errorId: string;
  label: string;
  definition: string;
  asks: string;
}

export function mapSpeakingError(raw: unknown): SpeakingError | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.error_id !== "string" ||
    typeof r.label !== "string" ||
    typeof r.definition !== "string" ||
    typeof r.asks !== "string"
  ) return null;
  return {
    errorId: r.error_id,
    label: r.label,
    definition: r.definition,
    asks: r.asks,
    // Anything that is not literally "detected" or "shadow" is treated as
    // observed. A row whose status we cannot read must never be shown as
    // routing exercises.
    status: r.status === "detected" || r.status === "shadow" ? r.status : "observed",
    detectorRef: typeof r.detector_ref === "string" ? r.detector_ref : null,
    observedBy: typeof r.observed_by === "string" ? r.observed_by : null,
    active: r.active !== false,
  };
}

function call<T>(init: RequestInit, pick: (data: unknown) => T): Promise<LibraryResult<T>> {
  return messageCall("/api/v2/coach/speaking-errors", init, coachReadError, pick);
}

/** The whole library, retired entries included — an author who cannot see a
 *  retired entry names it a second time and the upsert overwrites the first. */
export function listSpeakingErrors() {
  return call({ method: "GET" }, (data) => {
    const d = data && typeof data === "object"
      ? data as Record<string, unknown> : {};
    return (Array.isArray(d.errors) ? d.errors : [])
      .map(mapSpeakingError)
      .filter((item): item is SpeakingError => item !== null);
  });
}

/** Name and define one OBSERVED pattern.
 *
 *  `observed_by` is NOT sent: the backend takes it from the authenticated
 *  caller, because a self-declared author is not provenance. */
export function saveSpeakingError(draft: SpeakingErrorDraft) {
  return call(
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error_id: draft.errorId.trim(),
        label: draft.label.trim(),
        definition: draft.definition.trim(),
        asks: draft.asks.trim(),
      }),
    },
    (data) => {
      const d = data && typeof data === "object"
        ? data as Record<string, unknown> : {};
      return mapSpeakingError(d.error);
    },
  );
}
