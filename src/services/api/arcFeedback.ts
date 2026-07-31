import { getAuthToken } from "@/lib/api/auth-client";
import { notifyTokensSpent } from "@/lib/willabWindowEvents";

/* -------------------------------------------------------------------------- */
/*  arcFeedback — the per-take feedback packet (delivery layer)                */
/*                                                                            */
/*  GET /v2/explore/arc/<arc_id>/feedback → the user's 3 takes, each with the   */
/*  coach-verified full text (assembled in piece order, no playback) + the      */
/*  coach-surfaced key moments (playback + comment text/video), grouped by      */
/*  slide FE-side. Take 1 is free; a gated take (2/3, pre-unlock) arrives as    */
/*  {free:false, locked:true} with NO content — the FE renders the paywall.     */
/*                                                                            */
/*  Safe-ahead: null on 404/error (the BE endpoint ships with the delivery      */
/*  layer) → the overlay shows a calm "coach is still working" state.          */
/* -------------------------------------------------------------------------- */

export interface FeedbackKeyMoment {
  snippetId: string;
  /** The deck slide this moment was delivered on; null = deckless/general. */
  slideIndex: number | null;
  /** Spoken take vs a re-read; null = unknown (older payloads). */
  recordingKind: "spoken" | "read" | null;
  transcript: string;
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  /** The coach's comment — text and/or video, whichever they attached. */
  commentText: string | null;
  commentVideoRef: string | null;
}

export interface FeedbackTake {
  takeIndex: number;
  sessionId: string;
  free: boolean;
  /** True = pay-gated, no content in this row (render the paywall). */
  locked: boolean;
  fullText: string;
  keyMoments: FeedbackKeyMoment[];
}

export interface ArcFeedback {
  arcId: string;
  takes: FeedbackTake[];
  idealReady: boolean;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function int(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function mapKeyMoment(raw: unknown): FeedbackKeyMoment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const snippetId = str(r.snippet_id);
  if (!snippetId) return null;
  return {
    snippetId,
    slideIndex:
      typeof r.slide_index === "number" && Number.isFinite(r.slide_index)
        ? r.slide_index
        : null,
    recordingKind:
      r.recording_kind === "read"
        ? "read"
        : r.recording_kind === "spoken"
        ? "spoken"
        : null,
    transcript: str(r.transcript),
    audioRef: str(r.audio_ref) || null,
    startOffsetMs: int(r.start_offset_ms),
    durationMs: int(r.duration_ms),
    commentText: str(r.comment_text) || null,
    commentVideoRef: str(r.comment_video_ref) || null,
  };
}

function mapTake(raw: unknown): FeedbackTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const takeIndex =
    typeof r.take_index === "number" && r.take_index > 0 ? r.take_index : null;
  if (takeIndex === null) return null;
  return {
    takeIndex,
    sessionId: str(r.session_id),
    free: r.free === true,
    locked: r.locked === true,
    fullText: str(r.full_text),
    keyMoments: Array.isArray(r.key_moments)
      ? r.key_moments
          .map(mapKeyMoment)
          .filter((m): m is FeedbackKeyMoment => m !== null)
      : [],
  };
}

export function mapArcFeedback(raw: unknown): ArcFeedback | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const takes = Array.isArray(r.takes)
    ? r.takes
        .map(mapTake)
        .filter((t): t is FeedbackTake => t !== null)
        .sort((a, b) => a.takeIndex - b.takeIndex)
    : [];
  return {
    arcId: str(r.arc_id),
    takes,
    idealReady: r.ideal_ready === true,
  };
}

/** Group a take's key moments by slide for rendering: slides sorted ascending,
 *  the deckless/general (null) group trailing. One group when nothing is
 *  slide-tagged. Pure for testability. */
export function groupKeyMomentsBySlide(
  moments: FeedbackKeyMoment[]
): { slideIndex: number | null; moments: FeedbackKeyMoment[] }[] {
  const byKey = new Map<number | null, FeedbackKeyMoment[]>();
  for (const m of moments) {
    const list = byKey.get(m.slideIndex);
    if (list) list.push(m);
    else byKey.set(m.slideIndex, [m]);
  }
  const groups = [...byKey.entries()].map(([slideIndex, list]) => ({
    slideIndex,
    moments: list.sort((a, b) => a.startOffsetMs - b.startOffsetMs),
  }));
  groups.sort((a, b) => {
    if (a.slideIndex === null) return 1;
    if (b.slideIndex === null) return -1;
    return a.slideIndex - b.slideIndex;
  });
  return groups;
}

/** Fetch the arc's feedback packet. null = not available yet (endpoint absent,
 *  error, or the coach hasn't published) → the caller shows a calm wait state. */
export async function fetchArcFeedback(
  arcId: string
): Promise<ArcFeedback | null> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/feedback`,
      { headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  // TOKEN PRICING — this read is metered. The BE charges the `insights` price
  // here (1,000 today), once per arc, keyed on the arc id: re-opening the same
  // arc's feedback is free, and the charge is fail-open, so it never blocks or
  // alters what comes back.
  //
  // Nothing about that is visible on the way in, which is the problem this
  // line solves: without it the header balance would simply be lower the next
  // time it polled, and an unexplained drop reads as either a bug or a charge
  // the user did not make. Re-reading the balance now ties the change to the
  // action that caused it. Balance reads are free, so this costs nothing.
  //
  // Keyed on the RESPONSE, not on whether the body parsed: the charge belongs
  // to the request the BE served, and a shape this mapper cannot read does not
  // un-charge it. Gating on a successful parse would drop the refresh in
  // exactly the case where the user paid and got nothing back.
  //
  // NOT priced on the trigger, deliberately — see the note in FeedbackOverlay.
  notifyTokensSpent();
  return mapArcFeedback(await res.json().catch(() => null));
}
