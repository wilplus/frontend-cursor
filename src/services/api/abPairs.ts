import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  abPairs — the blinded A/B comparison queue (founder 2026-08-11)             */
/*                                                                            */
/*  The same slide, two takes, no labels. It anchors power_score's delivery    */
/*  term against human ratings and produces the matched cross-take pairs the   */
/*  alignment spike is data-blocked on — piece (b)'s two blockers, from one    */
/*  coach act.                                                                 */
/*                                                                            */
/*  NOTE WHAT A SIDE DOES NOT HAVE: no session id, no take index, no           */
/*  timestamp. That is the instrument, enforced by the backend — this type is  */
/*  written to MATCH it, so a future field that identifies a take would have   */
/*  to be added here deliberately rather than arriving by accident.            */
/* -------------------------------------------------------------------------- */

export interface AbSide {
  transcript: string;
  audioRef: string | null;
  startOffsetMs: number | null;
  durationMs: number | null;
}

export interface AbPair {
  pairId: string;
  slideIndex: number;
  slideTitle: string;
  left: AbSide;
  right: AbSide;
}

export type AbVerdict = "left" | "right" | "tie";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function mapSide(raw: unknown): AbSide {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    transcript: typeof r.transcript === "string" ? r.transcript : "",
    audioRef: typeof r.audio_ref === "string" ? r.audio_ref : null,
    startOffsetMs: num(r.start_offset_ms),
    durationMs: num(r.duration_ms),
  };
}

/** The queue for one arc. Already-rated pairs are dropped server-side unless
 *  `all` — re-rating is legitimate (it is how intra-rater reliability gets
 *  measured), it just should not be the default queue.
 *
 *  Returns null on transport failure, [] on "nothing to compare" — the two
 *  are different states and the screen says different things about them. */
export async function fetchAbPairs(
  arcId: string,
  opts?: { all?: boolean }
): Promise<{ pairs: AbPair[]; ratedCount: number; reason: string | null } | null> {
  const result = await bffFetch(
    `/api/v2/coach/arcs/${encodeURIComponent(arcId)}/ab-pairs${
      opts?.all ? "?all=1" : ""
    }`,
    { cache: "no-store" }
  );
  if (result.kind !== "response" || !result.ok) return null;
  const data = result.body as Record<string, unknown> | null;
  if (!data) return null;
  const rows = Array.isArray(data.pairs) ? data.pairs : [];
  return {
    pairs: rows
      .map((raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        if (typeof r.pair_id !== "string" || typeof r.slide_index !== "number") {
          return null;
        }
        return {
          pairId: r.pair_id,
          slideIndex: r.slide_index,
          slideTitle: typeof r.slide_title === "string" ? r.slide_title : "",
          left: mapSide(r.left),
          right: mapSide(r.right),
        };
      })
      .filter((p): p is AbPair => p !== null),
    ratedCount: typeof data.rated_count === "number" ? data.rated_count : 0,
    reason: typeof data.reason === "string" ? data.reason : null,
  };
}

/** Record one judgment. The backend resolves the blinded side to a real
 *  session; nothing here learns which take won, deliberately — a rater who
 *  found out would start rating the story instead of the delivery. */
export async function saveAbVerdict(
  arcId: string,
  pairId: string,
  verdict: AbVerdict
): Promise<boolean> {
  const result = await bffFetch(
    `/api/v2/coach/arcs/${encodeURIComponent(arcId)}/ab-verdict`,
    {
      method: "PUT",
      json: { pair_id: pairId, verdict },
      cache: "no-store",
    }
  );
  return result.kind === "response" && result.ok;
}
