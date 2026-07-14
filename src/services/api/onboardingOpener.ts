import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  onboardingOpener — the first-contact dad-joke opener client (#1)           */
/*                                                                            */
/*  A structured, multi-turn opener the Lounge fires when the user accepts the  */
/*  "want a joke?" offer (after a nervous check-in). Three guest-allowed calls:  */
/*    start → { stage:"setup", joke_id, frame, setup }  (or 204 = no opener)    */
/*    next  { joke_id, user_reply }        → the punchline                      */
/*    next  { joke_id, after_punchline }   → the pivot into onboarding          */
/*                                                                            */
/*  Safe-ahead: field extraction is defensive (the BE's exact line-field name   */
/*  isn't pinned yet), and any failure resolves to a silent skip rather than an  */
/*  error banner — an icebreaker must never block onboarding.                   */
/* -------------------------------------------------------------------------- */

export type OpenerStart =
  | { kind: "opener"; jokeId: string; frame: string; setup: string }
  | { kind: "none" } // 204 — no opener to run; skip silently
  | { kind: "error" }; // network / malformed → also skip silently

/** First non-empty trimmed string among `keys`, or "". */
function firstString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return "";
}

/** Start the opener. 204 → {kind:"none"} (skip silently). Any error → same
 *  intent, distinguished only for logging. A missing joke_id is unusable → error. */
export async function fetchOpenerStart(): Promise<OpenerStart> {
  const token = await getAuthToken(); // optional — the opener greets guests
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch("/api/v2/onboarding/opener/start", {
      method: "POST",
      headers,
      body: "{}",
      credentials: "include",
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 204) return { kind: "none" };
  if (!res.ok) return { kind: "error" };

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return { kind: "error" };
  const jokeId = firstString(body, ["joke_id", "jokeId", "id"]);
  if (!jokeId) return { kind: "error" };
  return {
    kind: "opener",
    jokeId,
    frame: firstString(body, ["frame"]),
    setup: firstString(body, ["setup"]),
  };
}

/** Advance the opener. Pass `userReply` to get the punchline, or
 *  `afterPunchline:true` to get the pivot. Returns the line to show, or null on
 *  any failure (the caller drops it silently). */
export async function fetchOpenerNext(
  jokeId: string,
  opts: { userReply?: string; afterPunchline?: boolean }
): Promise<string | null> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const payload: Record<string, unknown> = { joke_id: jokeId };
  if (opts.afterPunchline) payload.after_punchline = true;
  if (opts.userReply != null) payload.user_reply = opts.userReply;

  let res: Response;
  try {
    res = await fetch("/api/v2/onboarding/opener/next", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      credentials: "include",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return null;
  // The line field isn't pinned yet — accept the common shapes, newest-intent
  // first, and never surface joke_id/stage as the line.
  const line = firstString(body, [
    "text",
    "punchline",
    "pivot",
    "line",
    "message",
    "body",
  ]);
  return line || null;
}
