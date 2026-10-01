import { getAuthToken } from "@/lib/api/auth-client";

/** What a bookmark can have on screen when it opens: the sheet's own
 *  report, kept by the backend to these kinds (migration 0408). */
export type MomentShown =
  | "question"
  | "praise"
  | "rewrite"
  | "exercise"
  | "coach_request"
  | "coach_answer";

export type MomentEvent = "opened" | "skipped";

/** What the backend said about one open or skip.
 *  - `recorded`: this call recorded the event (once per moment and event).
 *  - `followUp`: what the sheet may show next, when the backend chose it at
 *    the open (Phase 2, founder 2026-10-01, F1; "none" until that switch).
 *  - `ignored`: the event was already recorded.
 *  - `failed`: anything else (404, network, no session). Never retried. */
export type MomentEventOutcome =
  | { kind: "recorded"; followUp: string }
  | { kind: "ignored"; followUp: string }
  | { kind: "failed" };

/** Tell the backend the speaker opened or skipped this bookmark, and what
 *  was on screen. Fire-and-forget: it never throws, and nothing about it
 *  reaches the speaker beyond what the sheet may show next. The sheet's
 *  use of `followUp` is the designer session's to build. */
export async function reportMomentEvent(
  snippetId: string,
  event: MomentEvent,
  shown: readonly MomentShown[] = [],
): Promise<MomentEventOutcome> {
  try {
    const token = await getAuthToken();
    if (!token) return { kind: "failed" };
    const res = await fetch(
      `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/moment-event`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event, shown: [...shown] }),
      },
    );
    if (!res.ok) return { kind: "failed" };
    const data = (await res.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const followUp =
      typeof data?.follow_up === "string" ? data.follow_up : "none";
    return data?.recorded === true
      ? { kind: "recorded", followUp }
      : { kind: "ignored", followUp };
  } catch {
    return { kind: "failed" };
  }
}
