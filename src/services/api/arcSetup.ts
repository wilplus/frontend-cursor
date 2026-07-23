import { getAuthToken } from "@/lib/api/auth-client";
import type { PresentationSlide } from "@/components/willab/presentation";

/* -------------------------------------------------------------------------- */
/*  arcSetup — the project's recording setup, for context-aware official       */
/*  recording (founder 2026-07-23, BE #233).                                  */
/*                                                                            */
/*  GET /v2/explore/arc/<arc_id>/setup → everything a new take of THIS project */
/*  inherits: topic, audience, target length, slides + the served deck PDF. So */
/*  "record another take" (in-project) OR picking a project from the dashboard */
/*  drops straight into the recorder with the deck and countdown already set,  */
/*  no bounce back to the chat. Owner-only → 404 on a foreign / unknown arc.   */
/* -------------------------------------------------------------------------- */

export interface ArcSetup {
  topic: string;
  audience: string | null;
  targetLengthSeconds: number | null;
  slides: PresentationSlide[];
  presentationRef: string | null;
}

/** Fetch the arc's setup. null on any non-200 (not owner / no takes / error)
 *  so the caller degrades to a blank setup rather than blocking the record. */
export async function fetchArcSetup(arcId: string): Promise<ArcSetup | null> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/setup`,
      { headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body.topic !== "string" || !body.topic.trim()) {
    // `topic` is load-bearing (the record POST rejects a take without one);
    // without it there is nothing usable to inherit.
    return null;
  }
  const slides = Array.isArray(body.slides)
    ? body.slides
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => ({
          title: typeof s.title === "string" ? s.title : "",
          body: typeof s.body === "string" ? s.body : "",
        }))
    : [];
  return {
    topic: body.topic,
    audience:
      typeof body.audience === "string" && body.audience.trim()
        ? body.audience
        : null,
    targetLengthSeconds:
      typeof body.target_length_seconds === "number" &&
      Number.isFinite(body.target_length_seconds) &&
      body.target_length_seconds > 0
        ? body.target_length_seconds
        : null,
    slides,
    presentationRef:
      typeof body.presentation_ref === "string" && body.presentation_ref
        ? body.presentation_ref
        : null,
  };
}
