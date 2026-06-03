import type { WillabDomain } from "./domains";

/* -------------------------------------------------------------------------- */
/*  willabProfile — the one-time intake result (§2), stored locally           */
/*                                                                            */
/*  Captured once at Intake: domain (metadata) + a goal in the user's own      */
/*  words. Persisted to localStorage now so the Lab can default its            */
/*  `domain_vocabulary` (§4) and the coach has the goal to read — independent   */
/*  of network. The server profile (`/v2/user/profile`) is the system of       */
/*  record once its contract + migration land; this local copy then becomes a  */
/*  cache that the GET supersedes. Text-only; never audio, never KPI.         */
/* -------------------------------------------------------------------------- */

export interface WillabProfile {
  domain: WillabDomain;
  goal: string;
}

const KEY = "willab.profile";

export function readWillabProfile(): WillabProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WillabProfile> | null;
    if (!parsed || typeof parsed.domain !== "string") return null;
    return {
      domain: parsed.domain as WillabDomain,
      goal: typeof parsed.goal === "string" ? parsed.goal : "",
    };
  } catch {
    return null;
  }
}

export function writeWillabProfile(profile: WillabProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* best-effort; the intake_done flag still advances the flow */
  }
}
