import { getAuthToken } from "@/lib/api/auth-client";

export type FeedbackFamily =
  | "confident_voice"
  | "rewrite_clarity"
  | "great_formulation";

export type FeedbackResponse =
  | "yes" | "in_between" | "no" | "not_sure" | "audio_unclear"
  | "apply_suggestion" | "edit_myself" | "keep_wording"
  | "useful" | "not_useful";

export async function saveTakeFeedbackResponse(input: {
  takeSessionId: string;
  feedbackId: string;
  feedbackFamily: FeedbackFamily;
  response: FeedbackResponse;
  candidateId?: string | null;
  feedbackMembershipId?: string | null;
  feedbackExposureId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string | null }> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(
      `/api/v2/user/takes/${encodeURIComponent(input.takeSessionId)}/feedback-response`,
      {
        method: "POST",
        headers,
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          feedback_id: input.feedbackId,
          feedback_family: input.feedbackFamily,
          response: input.response,
          ...(input.candidateId && input.feedbackMembershipId && input.feedbackExposureId
            ? {
                candidate_id: input.candidateId,
                feedback_membership_id: input.feedbackMembershipId,
                feedback_exposure_id: input.feedbackExposureId,
              }
            : {}),
        }),
      }
    );
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: false, error: typeof body?.error === "string" ? body.error : null };
  } catch {
    return { ok: false, error: null };
  }
}
