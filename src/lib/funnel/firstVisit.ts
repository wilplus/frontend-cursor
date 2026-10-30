import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*  firstVisit — where people leave between the landing page and their first */
/*  feedback (backend N271: "introduce the counting where the people         */
/*  leave!"). Each step counts once per browser tab, and only for a visitor   */
/*  without an account; the backend keeps a number a day and nothing about   */
/*  the person. A count that fails is lost, never the screen.                 */
/*                                                                            */
/*  The sign-up screen and the accounts made keep their own count             */
/*  (SignupSeen.tsx, N207 item 6); the founder reads both together.           */
/* -------------------------------------------------------------------------- */

export type FirstVisitStep =
  | "landing"
  | "enter"
  | "agreed"
  | "recording"
  | "recorded"
  | "ready"
  | "walk";

const KEY = (step: FirstVisitStep) => `willab:first-visit:${step}`;

/** Count `step` once for this tab. The caller knows the visitor has no
 *  account (or, for "walk", has just made one). */
export function countFirstVisit(step: FirstVisitStep): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(KEY(step))) return;
    sessionStorage.setItem(KEY(step), "1");
  } catch {
    /* storage blocked: count this one anyway */
  }
  // keepalive: "walk" is counted just before the page navigates away.
  void fetch("/api/v2/first-visit/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Count `step` only when nobody is signed in on this browser. */
export function countFirstVisitIfGuest(step: FirstVisitStep): void {
  if (typeof window === "undefined") return;
  try {
    void createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (!session?.access_token) countFirstVisit(step);
      })
      .catch(() => undefined);
  } catch {
    /* no session client here: no count */
  }
}
