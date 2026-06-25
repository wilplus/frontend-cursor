/* -------------------------------------------------------------------------- */
/*  willabFeelings — pre-recording feeling capture (U10)                       */
/*                                                                            */
/*  The first-recording onboarding asks how the user feels before they speak.  */
/*  The BACKEND IS FROZEN, so the answer stays on-device for now: it powers the */
/*  immediate encouragement and is the single wiring point for the coach-facing */
/*  signal once the freeze lifts (swap the localStorage write for a POST). No   */
/*  judgement is derived from it — it's the user naming their own state, which  */
/*  the act of naming already helps with.                                       */
/*                                                                            */
/*  Best-effort localStorage (Safari private mode fails soft).                  */
/* -------------------------------------------------------------------------- */

export type Feeling = "nervous" | "excited" | "calm" | "unsure";

const FEELING_KEY = "willab.last_feeling";

function isFeeling(v: unknown): v is Feeling {
  return v === "nervous" || v === "excited" || v === "calm" || v === "unsure";
}

/** Capture the user's pre-recording feeling (FE-local under the freeze). */
export function recordFeeling(feeling: Feeling): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FEELING_KEY, feeling);
  } catch {
    /* swallow — Safari private mode etc. */
  }
}

/** Read back the last captured feeling, or null if none / invalid. */
export function getLastFeeling(): Feeling | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(FEELING_KEY);
    return isFeeling(v) ? v : null;
  } catch {
    return null;
  }
}

/** Consume the captured feeling. The pre-recording check-in only runs on the
 *  first recording, so a feeling left in place would gate later takes on a stale
 *  value; clearing it once consumed keeps the signal tied to the take that
 *  actually named it. Best-effort (Safari private mode fails soft). */
export function clearFeeling(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FEELING_KEY);
  } catch {
    /* swallow */
  }
}
