import { getAuthToken } from "@/lib/api/auth-client";

/** What the backend said about one "exercise rendered" confirmation.
 *  - `recorded`: the render counts as shown (MLC-3 §3.5).
 *  - `ignored`: the moment had no automatic pick; nothing to do.
 *  - `stale`: 409 EXERCISE_OFFER_STALE — the card shows another exercise than
 *    the one offered, so the host re-reads the Ideal Text.
 *  - `failed`: anything else (404, network, no session). Never retried. */
export type ExerciseRenderedOutcome = "recorded" | "ignored" | "stale" | "failed";

/** Tell the backend the speaker's app actually rendered this exercise card.
 *  Fire-and-forget: it never throws and nothing about it reaches the speaker. */
export async function reportExerciseRendered(
  snippetId: string,
  exerciseId: string,
): Promise<ExerciseRenderedOutcome> {
  try {
    const token = await getAuthToken();
    if (!token) return "failed";
    const res = await fetch(
      `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/exercise-rendered`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exercise_id: exerciseId }),
      },
    );
    if (res.status === 409) return "stale";
    if (!res.ok) return "failed";
    const data = (await res.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    return data?.recorded === true ? "recorded" : "ignored";
  } catch {
    return "failed";
  }
}
