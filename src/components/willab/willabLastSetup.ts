import { getAuthToken } from "@/lib/api/auth-client";
import { type LabSessionContext } from "./LabOverlay";
import { type PresentationSlide } from "./presentation";
import { coerceTargetSeconds } from "./willabHelpers";

/* -------------------------------------------------------------------------- */
/*  willabLastSetup — "Same as last time" prefill, sourced from the BE          */
/*                                                                            */
/*  GET /api/v2/user/last-setup → the user's most-recent session's intake       */
/*  context (topic / audience / length / key words / slides / deck). BE-sourced  */
/*  so it survives a cache clear and works cross-device. slide_advances is       */
/*  deliberately omitted (the new run makes its own tap timeline).              */
/* -------------------------------------------------------------------------- */

function parseSlides(raw: unknown): PresentationSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      title: typeof s.title === "string" ? s.title : "",
      body: typeof s.body === "string" ? s.body : "",
    }));
}

/** Map the /last-setup response → a re-fillable context, or null when there's
 *  no prior session (`available: false`) or the payload is malformed. */
export function mapLastSetup(raw: unknown): LabSessionContext | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.available !== true) return null;
  if (typeof r.topic !== "string" || r.topic.trim() === "") return null;
  return {
    topic: r.topic,
    audience: typeof r.audience === "string" ? r.audience : "",
    // R5 — coerce a numeric string too, so a string length restores the
    // countdown on takes 2/3 instead of being dropped.
    target_length_seconds: coerceTargetSeconds(r.target_length_seconds),
    domain_vocabulary: Array.isArray(r.domain_vocabulary)
      ? r.domain_vocabulary.filter((x): x is string => typeof x === "string")
      : [],
    slides: parseSlides(r.slides),
    presentationRef:
      typeof r.presentation_ref === "string" ? r.presentation_ref : null,
  };
}

/** Map a readout re-read's top-level `setup` block → a re-fillable context.
 *  Same field shape as /last-setup but without the `available` gate (BE-1). Used
 *  to restore a take's setup (topic / audience / length / slides / deck) from the
 *  server so take 2+ works even when localStorage lost the arc's deck. null when
 *  the block is absent or malformed (e.g. before the BE ships it → safe-ahead). */
export function mapReadoutSetup(raw: unknown): LabSessionContext | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.topic !== "string" || r.topic.trim() === "") return null;
  return {
    topic: r.topic,
    audience: typeof r.audience === "string" ? r.audience : "",
    // R5 — coerce a numeric string too, so a string length restores the
    // countdown on takes 2/3 instead of being dropped.
    target_length_seconds: coerceTargetSeconds(r.target_length_seconds),
    domain_vocabulary: Array.isArray(r.domain_vocabulary)
      ? r.domain_vocabulary.filter((x): x is string => typeof x === "string")
      : [],
    slides: parseSlides(r.slides),
    presentationRef:
      typeof r.presentation_ref === "string" ? r.presentation_ref : null,
  };
}

/** Fetch the last set-up for "Same as last time". null = nothing to repeat
 *  (guest, no prior session, or any failure → the button hides). */
export async function fetchLastSetup(): Promise<LabSessionContext | null> {
  const token = await getAuthToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch("/api/v2/user/last-setup", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  return mapLastSetup(await res.json().catch(() => null));
}
