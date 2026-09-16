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
/*                                                                            */
/*  A coach writes `observed` and nothing else. Marking one detected needs a   */
/*  detector in code, so it is set by the migration that adds one — never by   */
/*  a form. The backend refuses the claim either way; this module simply does  */
/*  not offer it.                                                             */
/* -------------------------------------------------------------------------- */

export type SpeakingErrorStatus = "observed" | "detected";

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

export type LibraryResult<T> =
  | { ok: true; data: T }
  /** `code` distinguishes a rewordable refusal (INVALID_INPUT) from
   *  ALREADY_DETECTED, which is not a mistake the author can fix by editing
   *  the form — it means the entry is load-bearing and must be left alone. */
  | { ok: false; status: number; message: string; code?: string };

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
    // Anything that is not literally "detected" is treated as observed. A row
    // whose status we cannot read must never be shown as routing exercises.
    status: r.status === "detected" ? "detected" : "observed",
    detectorRef: typeof r.detector_ref === "string" ? r.detector_ref : null,
    observedBy: typeof r.observed_by === "string" ? r.observed_by : null,
    active: r.active !== false,
  };
}

function readError(data: unknown, status: number): string {
  const d = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  if (typeof d.error === "string" && d.error.trim()) return d.error;
  if (status === 401 || status === 403) return "Coach access required.";
  return `Request failed (HTTP ${status}).`;
}

async function call<T>(
  init: RequestInit,
  pick: (data: unknown) => T,
): Promise<LibraryResult<T>> {
  let res: Response;
  let data: unknown;
  try {
    res = await fetch("/api/v2/coach/speaking-errors", init);
    data = await res.json().catch(() => ({}));
  } catch {
    return { ok: false, status: 0, message: "Network error. Try again." };
  }
  if (!res.ok) {
    const code = (data as Record<string, unknown> | null)?.code;
    return {
      ok: false,
      status: res.status,
      message: readError(data, res.status),
      ...(typeof code === "string" && code ? { code } : {}),
    };
  }
  return { ok: true, data: pick(data) };
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

/* -------------------------------------------------------------------------- */
/*  Client-side validation                                                     */
/*                                                                            */
/*  Mirrors ERROR_ID_SHAPE in services/speaking_error_library.py, which itself */
/*  mirrors a CHECK constraint. Duplicated on purpose at every layer: matching */
/*  is string overlap, so `word compression` and `word_compression` would      */
/*  match nothing, raise nothing, and route nothing. The database is the real  */
/*  guard; this exists so an author is told why before they submit.           */
/* -------------------------------------------------------------------------- */

export const ERROR_ID_SHAPE = /^[a-z][a-z0-9_]{1,62}$/;

/** A sentence explaining the first problem with a draft, or null if it is
 *  ready to send. Field order matches the form's reading order. */
export function draftProblem(draft: SpeakingErrorDraft): string | null {
  if (!ERROR_ID_SHAPE.test(draft.errorId.trim())) {
    return "The id needs lower-case letters, digits and underscores only, starting with a letter — matching is string overlap, so a space or a capital would match nothing.";
  }
  if (!draft.label.trim()) return "Give it a short human name.";
  if (!draft.definition.trim()) {
    return "Write what is measured. A name with no definition is exactly the defect the construct fence exists to prevent.";
  }
  if (!draft.asks.trim()) {
    return "Write the single question this pattern answers — one thing, never two.";
  }
  return null;
}

/** The id a label suggests, so the common case needs no thinking about shape. */
export function suggestErrorId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "")
    .slice(0, 63);
}
