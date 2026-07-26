import { type LabSessionContext } from "./LabOverlay";
import { type PresentationSlide } from "./presentation";
import { coerceTargetSeconds } from "./willabHelpers";

/* -------------------------------------------------------------------------- */
/*  willabLastSetup — restore a take's setup from a readout payload            */
/*                                                                            */
/*  The manual "Same as last time" affordance was removed (FE-2), and with it   */
/*  the /last-setup fetch. What remains is the readout's own `setup` block,      */
/*  which restores a take's context (topic / audience / length / slides / deck)  */
/*  so a next take works even when localStorage lost the arc's deck.            */
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
    // ④ step 5 — prefill the strategic-context note when the BE echoes it
    // (inert until then; the field is optional so absence is fine).
    strategicContext:
      typeof r.strategic_context === "string" && r.strategic_context.trim()
        ? r.strategic_context
        : undefined,
  };
}

