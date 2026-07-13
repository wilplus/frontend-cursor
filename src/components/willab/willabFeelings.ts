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

// The ACTIVE feeling for the current take (consumed + cleared on upload).
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

/** Consume the ACTIVE feeling for this take (cleared after the upload captures
 *  it) so a later take can't be gated on a stale value. Best-effort (Safari
 *  private mode fails soft). */
export function clearFeeling(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FEELING_KEY);
  } catch {
    /* swallow */
  }
}
