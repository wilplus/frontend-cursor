import { getAuthToken } from "@/lib/api/auth-client";
import { markerTokenSpans } from "@/lib/willab/richMarkers";

/* -------------------------------------------------------------------------- */
/*  idealText — the arc's ONE-BLOCK ideal text (delivery layer)                */
/*                                                                            */
/*  The paywalled deliverable: auto-assembled after 3 takes, coach-edited as    */
/*  a single clean block, approved, then sent as the purple bubble. The user    */
/*  reads it in the notebook overlay (bold openings = key_phrases, underlined   */
/*  key moments deep-linking back to the feedback page) and may keep a          */
/*  PERSONAL edited copy (notes) that never touches the coach-approved          */
/*  canonical (L1).                                                            */
/*                                                                            */
/*  Safe-ahead: every call soft-fails; locked (402) and pending (404 /          */
/*  unapproved) are first-class states, not errors.                            */
/* -------------------------------------------------------------------------- */

export interface IdealKeyMomentLink {
  /** The literal text fragment inside `text` to underline. */
  anchor: string;
  snippetId: string;
  takeSessionId: string;
}

export interface IdealText {
  text: string;
  /** Coach key phrases (≤5) — the "bolded openings". */
  keyPhrases: string[];
  keyMoments: IdealKeyMomentLink[];
  approved: boolean;
  /** The user's personal notebook copy; null until they save one. */
  notes: string | null;
}

export type IdealTextResult =
  | { kind: "ready"; ideal: IdealText }
  | { kind: "locked" } // 402 — the $25 unlock opens it
  | { kind: "pending" } // 404 / not approved yet — coach still working
  | { kind: "error" };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function mapKeyMoment(raw: unknown): IdealKeyMomentLink | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const anchor = str(r.anchor);
  const snippetId = str(r.snippet_id);
  const takeSessionId = str(r.take_session_id);
  if (!anchor || !snippetId) return null;
  return { anchor, snippetId, takeSessionId };
}

export function mapIdealText(raw: unknown): IdealText | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = str(r.text);
  if (!text) return null;
  return {
    text,
    keyPhrases: Array.isArray(r.key_phrases)
      ? r.key_phrases.filter((p): p is string => typeof p === "string" && p.length > 0)
      : [],
    keyMoments: Array.isArray(r.key_moments)
      ? r.key_moments
          .map(mapKeyMoment)
          .filter((m): m is IdealKeyMomentLink => m !== null)
      : [],
    approved: r.approved === true,
    notes: str(r.notes) || str(r.user_notes) || null,
  };
}

/** Student fetch — gated by the $25 unlock; pending until the coach approves. */
export async function fetchIdealText(arcId: string): Promise<IdealTextResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text`,
      { headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 402) return { kind: "locked" };
  if (res.status === 404) return { kind: "pending" };
  if (!res.ok) return { kind: "error" };
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.locked === true) return { kind: "locked" };
  const ideal = mapIdealText(body);
  if (!ideal) return { kind: "pending" };
  if (!ideal.approved) return { kind: "pending" };
  return { kind: "ready", ideal };
}

/** Save the user's PERSONAL notebook copy (A6 — never the canonical). */
export async function saveIdealNotes(
  arcId: string,
  text: string
): Promise<boolean> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text/notes`,
      {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ text }),
      }
    );
  } catch {
    return false;
  }
  return res.ok;
}

/* ------------------------------ coach lane -------------------------------- */

export interface CoachIdealText {
  /** The auto-assembled draft merged with any saved coach edit. */
  text: string;
  approved: boolean;
  /** BE-B — the eager assembler's status. "pending" = fewer than 3 spoken
   *  takes (nothing to review yet); "empty" = takes are in but nothing to
   *  assemble yet (no coach-confirmed key moments — the BE no longer serves a
   *  "ready" empty block); "ready" = the persisted draft exists and the editor
   *  can open instantly. null only on legacy payloads → treated as a soft
   *  error now that the BE always sends assembly_state. */
  assemblyState: "pending" | "empty" | "ready" | null;
  /** Spoken-take counts for the pending copy ("N of M takes recorded").
   *  null when the payload omits them. */
  takesDone: number | null;
  takesTarget: number | null;
  /** FP-1 — provenance: "machine" (the auto-assembled draft, untouched) vs
   *  "coach" (the coach has edited it). Drives a coach-only chip. null on
   *  older payloads → the chip hides. */
  source: "machine" | "coach" | null;
  /** The arc's deck (for the redesign's cover slide). Safe-ahead: null until
   *  the BE echoes presentation_ref here → the panel shows a blank cover. */
  presentationRef: string | null;
}

export async function fetchCoachIdealText(
  arcId: string
): Promise<CoachIdealText | null> {
  const token = await getAuthToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/arc/${encodeURIComponent(arcId)}/ideal-text`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return null;
  const text = str(body.text);
  const count = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  return {
    text,
    approved:
      body.approved === true ||
      (typeof body.approved_at === "string" && body.approved_at.length > 0),
    assemblyState:
      body.assembly_state === "pending"
        ? "pending"
        : body.assembly_state === "empty"
        ? "empty"
        : body.assembly_state === "ready"
        ? "ready"
        : null,
    takesDone: count(body.takes_done),
    takesTarget: count(body.takes_target),
    source:
      body.source === "coach"
        ? "coach"
        : body.source === "machine"
        ? "machine"
        : null,
    presentationRef:
      typeof body.presentation_ref === "string" &&
      body.presentation_ref.length > 0
        ? body.presentation_ref
        : null,
  };
}

export async function saveCoachIdealText(
  arcId: string,
  text: string
): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/arc/${encodeURIComponent(arcId)}/ideal-text`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );
  } catch {
    return false;
  }
  return res.ok;
}

export async function approveIdealText(arcId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/arc/${encodeURIComponent(arcId)}/ideal-text/approve`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    return false;
  }
  return res.ok;
}

/* ------------------------- notebook text segments ------------------------- */

/** One render segment of the notebook text: plain, bold (key phrase), or an
 *  underlined key-moment link. */
export interface IdealSegment {
  text: string;
  bold?: boolean;
  moment?: IdealKeyMomentLink;
}

/** Split the ideal text into render segments: the FIRST case-insensitive
 *  occurrence of each key-moment anchor becomes an underlined link segment,
 *  the first occurrence of each key phrase becomes bold. Overlaps resolve
 *  first-come (earlier start wins; moments matched before phrases). A range
 *  that would slice a rich-marker token in half is dropped (FE-9): the text
 *  may carry coach markers, and cutting one mid-token would leak raw marker
 *  syntax into the flanking segments. A token FULLY inside a range is fine —
 *  the segment's own marker rendering handles it. Pure. */
export function segmentIdealText(
  text: string,
  keyPhrases: string[],
  keyMoments: IdealKeyMomentLink[]
): IdealSegment[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tokenSpans = markerTokenSpans(text);
  // True when [start, end) partially overlaps a marker token (either boundary
  // inside the token, or the range strictly inside it).
  const slicesToken = (start: number, end: number): boolean =>
    tokenSpans.some(
      ([ts, te]) => start < te && end > ts && !(ts >= start && te <= end)
    );
  type Range = { start: number; end: number; bold?: boolean; moment?: IdealKeyMomentLink };
  const candidates: Range[] = [];
  for (const m of keyMoments) {
    const a = m.anchor.trim().toLowerCase();
    if (!a) continue;
    const i = lower.indexOf(a);
    if (i >= 0 && !slicesToken(i, i + a.length)) {
      candidates.push({ start: i, end: i + a.length, moment: m });
    }
  }
  for (const p of keyPhrases) {
    const q = p.trim().toLowerCase();
    if (!q) continue;
    const i = lower.indexOf(q);
    if (i >= 0 && !slicesToken(i, i + q.length)) {
      candidates.push({ start: i, end: i + q.length, bold: true });
    }
  }
  // Earlier start wins; a moment beats a phrase at the same start (it carries
  // the deep-link). Drop anything overlapping an accepted range.
  candidates.sort(
    (a, b) => a.start - b.start || (a.moment ? -1 : 1) - (b.moment ? -1 : 1)
  );
  const accepted: Range[] = [];
  for (const c of candidates) {
    if (accepted.some((r) => c.start < r.end && c.end > r.start)) continue;
    accepted.push(c);
  }
  const segments: IdealSegment[] = [];
  let cursor = 0;
  for (const r of accepted) {
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start) });
    segments.push({
      text: text.slice(r.start, r.end),
      bold: r.bold,
      moment: r.moment,
    });
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
