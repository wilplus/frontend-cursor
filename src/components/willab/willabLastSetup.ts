import { type LabSessionContext } from "./LabOverlay";
import { type PresentationSlide } from "./presentation";

/* -------------------------------------------------------------------------- */
/*  willabLastSetup — remember the last recording set-up (FE-local)            */
/*                                                                            */
/*  Persists the just-submitted SessionContext so the next set-up can re-fill  */
/*  it in one tap ("Same as last time"). localStorage only — freeze-safe, no   */
/*  BE write. Defensive read; a malformed / absent blob → null.                */
/* -------------------------------------------------------------------------- */

const KEY = "willab.last_setup";

export function saveLastSetup(ctx: LabSessionContext): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* swallow — private mode / quota */
  }
}

function parseSlides(raw: unknown): PresentationSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      title: typeof s.title === "string" ? s.title : "",
      body: typeof s.body === "string" ? s.body : "",
    }));
}

export function readLastSetup(): LabSessionContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.topic !== "string" || v.topic.trim() === "") return null;
    return {
      topic: v.topic,
      audience: typeof v.audience === "string" ? v.audience : "",
      target_length_seconds:
        typeof v.target_length_seconds === "number"
          ? v.target_length_seconds
          : null,
      domain_vocabulary: Array.isArray(v.domain_vocabulary)
        ? v.domain_vocabulary.filter((x): x is string => typeof x === "string")
        : [],
      slides: parseSlides(v.slides),
      presentationRef:
        typeof v.presentationRef === "string" ? v.presentationRef : null,
    };
  } catch {
    return null;
  }
}
