import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  starVerdicts — the coach's judgment on machine-fired stars (2026-07-27)    */
/*                                                                            */
/*  COACH-ONLY, and structurally so: this module is the star-verdict lane's    */
/*  single service, imported by exactly one surface (CoachStarVerdictOverlay). */
/*  A guard test (starVerdictSeparation.test.ts) enforces both directions:     */
/*  nothing in the blind-labeling flow may import this, and this may never be  */
/*  imported by a student-lane file. The fences it holds:                      */
/*                                                                            */
/*    N1 / BLIND COACH — this lane SHOWS the machine's guess (that is the       */
/*      point: the coach judges whether the star should have fired). The       */
/*      direction labeler must never see it, so the two lanes share no code.   */
/*      Deliberately independent of coachReview.ts — same conceptual family,   */
/*      separate lane, zero imports between them.                              */
/*    N2 / AC-9 — a verdict is coach→machine training signal. Nothing here     */
/*      touches a student payload, and no student mapper reads these fields.   */
/*    N3 — a wrong_kind verdict without its correction is nearly worthless,    */
/*      so buildVerdictBody refuses to construct one (returns null).           */
/*    N4 — the device vocabulary lives in the BE and will grow; correction     */
/*      options come from the row's device_options, never a hard-coded list.   */
/*      (STAR_KINDS below is the API contract's closed kind enum — the spec's  */
/*      own fallback for single-device kinds — not the device vocabulary.)     */
/*    N5 — verdicts are re-editable; the PUT is an upsert. The mapper renders  */
/*      the saved verdict as current state, never as a locked answer.          */
/*                                                                            */
/*  Wire notes: `summary.confusions` and `summary.false_negatives_captured`    */
/*  are internal bookkeeping — deliberately NOT mapped, so no surface can      */
/*  render them by accident. Progress ("3 of 7 reviewed") derives from the     */
/*  mapped rows so it always matches what is actually on screen.               */
/* -------------------------------------------------------------------------- */

/** The three-way judgment. Closed set — the corpus schema, not a vocabulary. */
export type StarVerdict = "keep" | "wrong_kind" | "should_not_fire";

/** The star FAMILIES in the API contract (star_kind). This is not the device
 *  vocabulary N4 protects — devices arrive per-row in `device_options`; the
 *  kind enum is contract-fixed the same way the verdict enum is. It exists
 *  here for one purpose the spec names: when `device_options` is empty
 *  (single-device kinds), "wrong kind" corrects to another FAMILY. */
export const STAR_KINDS = [
  "emphasize",
  "replace",
  "structure",
  "delivery",
] as const;

export interface ArcStar {
  /** Non-empty — a star without a snippet id cannot receive a verdict (the
   *  PUT is snippet-addressed), so such rows are dropped, never repaired. */
  snippetId: string;
  /** Non-empty — echoed verbatim on the PUT; a row without it is unsaveable. */
  starKind: string;
  /** Delivery stars carry their device; other kinds are usually null.
   *  Echoed VERBATIM on the PUT (null included) — never reconstructed. */
  starDevice: string | null;
  /** The machine's raw trigger (delivery: the device; replace: e.g. threat /
   *  profanity / stickiness). Used only to filter self-corrections out of the
   *  wrong-kind picker — never rendered as a score or classifier output. */
  trigger: string | null;
  /** The machine's stated reason, when it has one. Qualitative free text. */
  why: string | null;
  replacementText: string | null;
  /** null = unjudged. An unknown wire value also maps to null: the row stays
   *  judgeable and the next save upserts over it — the corpus wants the
   *  coach's current view (N5), and dropping the whole row would hide a star
   *  from review over a field this surface exists to (re)write. */
  verdict: StarVerdict | null;
  correctedDevice: string | null;
  /** The coach's own note, if they left one. */
  note: string | null;
  /** What "wrong kind" may be corrected TO (N4) — served, never hard-coded.
   *  Empty for single-device kinds. */
  deviceOptions: string[];
  /** Opaque passthrough: sent back on the PUT only when the row carried it. */
  starVersion: string | number | null;

  /* --- playback context (founder 2026-07-27): the coach cannot verify a
   *     star without HEARING the moment it fired on. Same wire vocabulary as
   *     the labeler payload (audio_ref = resolved playable URL, offsets clamp
   *     the slice out of the take's file) — mapped defensively, so a payload
   *     that omits them degrades to a text-only row instead of breaking. --- */
  /** Resolved playable URL of the take's audio (usually the whole file). */
  audioRef: string | null;
  /** Where this snippet's slice starts in that file (ms). */
  startOffsetMs: number;
  /** Slice length (ms). 0 = unknown — the clamped player needs a real one. */
  durationMs: number;
  /** What was said in the slice — the words the star fired on. */
  transcript: string | null;
  /** Which take the snippet belongs to, when the BE says (1-based). */
  takeIndex: number | null;
}

export interface ArcStars {
  arcId: string;
  stars: ArcStar[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Millisecond fields: a finite non-negative number, else 0. */
function ms(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

function pickVerdict(v: unknown): StarVerdict | null {
  return v === "keep" || v === "wrong_kind" || v === "should_not_fire"
    ? v
    : null;
}

/** One wire row → ArcStar. Drops rows that cannot take a verdict (no snippet
 *  id / no kind); degrades everything else — a missing why is a star with
 *  nothing to say, not an error. */
export function mapArcStar(raw: unknown): ArcStar | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const snippetId = str(r.snippet_id);
  const starKind = str(r.star_kind);
  if (!snippetId || !starKind) return null;
  return {
    snippetId,
    starKind,
    starDevice: strOrNull(r.star_device),
    trigger: strOrNull(r.trigger),
    why: strOrNull(r.why),
    replacementText: strOrNull(r.replacement_text),
    verdict: pickVerdict(r.verdict),
    correctedDevice: strOrNull(r.corrected_device),
    note: strOrNull(r.note),
    deviceOptions: Array.isArray(r.device_options)
      ? r.device_options.filter(
          (d): d is string => typeof d === "string" && d.length > 0
        )
      : [],
    starVersion:
      typeof r.star_version === "string" || typeof r.star_version === "number"
        ? r.star_version
        : null,
    // Playback context — same aliases the two existing payloads use
    // (coachReview: audio_ref; student moments: snippet_audio_ref first).
    audioRef: strOrNull(r.audio_ref) ?? strOrNull(r.snippet_audio_ref),
    startOffsetMs: ms(r.start_offset_ms),
    durationMs: ms(r.duration_ms),
    transcript: strOrNull(r.transcript),
    takeIndex:
      typeof r.take_index === "number" &&
      Number.isFinite(r.take_index) &&
      r.take_index > 0
        ? r.take_index
        : null,
  };
}

/** The arc payload. Ordering is server-side (unjudged first, then by family)
 *  — rows are kept in payload order, never re-sorted here or in the UI. */
export function mapArcStars(raw: unknown): ArcStars | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.stars)) return null;
  return {
    arcId: str(r.arc_id),
    stars: r.stars.map(mapArcStar).filter((s): s is ArcStar => s !== null),
  };
}

/* ------------------------------ pure helpers ------------------------------ */

/** A row's identity WITHIN this arc's list. Snippet id alone is not enough:
 *  one snippet can carry two stars (a delivery star and a structure star both
 *  name the same snippet), which is exactly why the PUT body repeats
 *  star_kind/star_device instead of trusting the URL. UI state keyed by
 *  snippet id alone would cross-contaminate such rows. */
export function starRowKey(star: ArcStar): string {
  return `${star.snippetId}|${star.starKind}|${star.starDevice ?? ""}`;
}

/** What the wrong-kind picker offers for this star.
 *
 *  The served `device_options` minus the star's own device/trigger — the BE
 *  includes the fired device in the list (see the contract example), and
 *  "wrong kind, corrected to the same kind" is not a correction. When nothing
 *  remains (single-device kinds serve `[]`), the correction targets are the
 *  OTHER star families, per the spec's own fallback. */
export function correctionOptions(star: ArcStar): string[] {
  const self = new Set(
    [star.starDevice, star.trigger].filter((v): v is string => v !== null)
  );
  const fromPayload = star.deviceOptions.filter((d) => !self.has(d));
  if (fromPayload.length > 0) return fromPayload;
  return STAR_KINDS.filter((k) => k !== star.starKind);
}

/** Wire label → words: "pace_fast" → "pace fast". No per-device copy table on
 *  purpose (N4) — a new BE device renders legibly with zero FE changes. */
export function humanizeToken(value: string): string {
  return value.replace(/_/g, " ");
}

/** The row chip: kind, plus the device when the star has one.
 *  "delivery" + "pace_fast" → "Delivery · pace fast". */
export function starChipLabel(star: ArcStar): string {
  const kind = humanizeToken(star.starKind);
  const cap = kind.charAt(0).toUpperCase() + kind.slice(1);
  return star.starDevice ? `${cap} · ${humanizeToken(star.starDevice)}` : cap;
}

/** The BE contract caps the note; the textarea also enforces this. */
export const NOTE_MAX_CHARS = 1000;

export interface StarVerdictBody {
  star_kind: string;
  /** Echoed verbatim from the GET row — null stays null. */
  star_device: string | null;
  verdict: StarVerdict;
  corrected_device?: string;
  note?: string;
  star_version?: string | number;
}

/** Build the PUT body — the ONE constructor for a verdict write.
 *
 *  N3 lives here, in code rather than in a submit handler: a `wrong_kind`
 *  without a correction returns null, so a body the BE would 400 cannot be
 *  constructed at all. `star_kind` / `star_device` are echoed verbatim from
 *  the row (never reconstructed), `star_version` rides along only when the
 *  row carried it, and the note is trimmed and clamped to the BE's cap. */
export function buildVerdictBody(
  star: ArcStar,
  verdict: StarVerdict,
  opts?: { correctedDevice?: string | null; note?: string | null }
): StarVerdictBody | null {
  const corrected = opts?.correctedDevice?.trim() ?? "";
  if (verdict === "wrong_kind" && !corrected) return null;

  const body: StarVerdictBody = {
    star_kind: star.starKind,
    star_device: star.starDevice,
    verdict,
  };
  if (verdict === "wrong_kind") body.corrected_device = corrected;
  const note = opts?.note?.trim().slice(0, NOTE_MAX_CHARS) ?? "";
  if (note) body.note = note;
  if (star.starVersion !== null) body.star_version = star.starVersion;
  return body;
}

/* --------------------------------- fetches -------------------------------- */

/** GET the arc's fired stars for review. Soft-fails to null (load-error line);
 *  `total: 0` arrives as an empty `stars` array — a valid state, not an error. */
export async function fetchCoachArcStars(
  arcId: string
): Promise<ArcStars | null> {
  const token = await getAuthToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(`/api/v2/coach/arc/${encodeURIComponent(arcId)}/stars`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as unknown;
  return mapArcStars(body);
}

export type SaveVerdictResult = { ok: true } | { ok: false; error: string | null };

/** PUT one verdict (upsert — re-judging replaces, N5). Never throws; the
 *  caller shows `error` inline when present (the BE's 400 reason is verbatim
 *  and safe to render, and the migration-gate 500 names the missing
 *  migration — degrade gracefully by showing exactly what it said). */
export async function saveStarVerdict(
  snippetId: string,
  body: StarVerdictBody
): Promise<SaveVerdictResult> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: null };
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/snippets/${encodeURIComponent(snippetId)}/star-verdict`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
  } catch {
    return { ok: false, error: null };
  }
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return { ok: false, error: strOrNull(data?.error) };
}
