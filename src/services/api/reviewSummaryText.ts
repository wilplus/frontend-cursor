import { bffFetch } from "@/lib/api/bffFetch";
import type { ReviewSummaryAsk } from "./reviewSummary";

/** Ask for the Take's closing summary and read its words back, for the
 *  walk's last lens step (founder lock 2026-10-12, sections 2.7 and 3). The
 *  backend writes it into the Lounge once per Take. Null on any failure:
 *  the walk then skips the step. */
export async function postReviewSummaryText(arcId: string, ask: ReviewSummaryAsk): Promise<string | null> {
  try {
    const result = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/review/summary`, {
      method: "POST",
      cache: "no-store",
      json: {
        take_session_id: ask.takeSessionId,
        practice: ask.practice,
        helper_words: ask.helperWords.slice(0, 2),
        coach_note: ask.coachNote,
      },
    });
    if (result.kind !== "response" || !result.ok) return null;
    const message = (result.body as { message?: unknown } | null)?.message;
    return typeof message === "string" && message.trim() ? message : null;
  } catch {
    return null;
  }
}
