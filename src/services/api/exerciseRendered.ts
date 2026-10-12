import { bffFetch } from "@/lib/api/bffFetch";

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
  const res = await bffFetch(
    `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/exercise-rendered`,
    { method: "POST", cache: "no-store", json: { exercise_id: exerciseId } },
  );
  if (res.kind !== "response") return "failed";
  if (res.status === 409) return "stale";
  if (!res.ok) return "failed";
  return (res.body as Record<string, unknown> | null)?.recorded === true ? "recorded" : "ignored";
}
