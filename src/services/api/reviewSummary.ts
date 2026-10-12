import { bffFetch } from "@/lib/api/bffFetch";

/** What the walk tells the summary (founder lock 2026-10-12, section 3):
 *  the practice result and at most two helper words. No number. */
export type ReviewSummaryAsk = {
  takeSessionId: string;
  practice: "better" | "not_yet" | null;
  helperWords: string[];
  coachNote: string | null;
};

/** Ask for the Take's closing summary; the backend writes it into the
 *  Lounge once. False on any failure (the signed journey message stays). */
export async function postReviewSummary(arcId: string, ask: ReviewSummaryAsk): Promise<boolean> {
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
    return result.kind === "response" && result.ok;
  } catch {
    return false;
  }
}
