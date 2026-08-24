import { getAuthToken } from "@/lib/api/auth-client";
import type { CoachPublishPayload } from "@/services/api/coachReviewState";

/* -------------------------------------------------------------------------- */
/*  arcBatch — the arc-level "Save and Publish full analysis" action.          */
/*                                                                            */
/*  Delivery layer: publishing the arc delivers the 4 bubbles (3 grey feedback  */
/*  + 1 purple ideal text). The BE requires all 3 takes SAVED (per-take         */
/*  save-feedback checkpoints) + the ideal text APPROVED, and 409s otherwise.   */
/*  The old student batch view (#186 / R4-11) is retired — feedback is per-take */
/*  now (arcFeedback.ts + FeedbackOverlay).                                     */
/* -------------------------------------------------------------------------- */

export type PublishArcResult =
  | { kind: "ok"; takesPublished: number; deliveredAt: string | null }
  | { kind: "error"; status: number; message: string };

/** POST publish (BFF → BE publish-analysis) — deliver the full analysis (4
 *  bubbles). The live 409s are TAKES_NOT_SAVED / IDEAL_TEXT_NOT_APPROVED;
 *  they surface via the BE's own message (the wrap-up's review-state read
 *  should have prevented them). */
export async function publishArc(
  arcId: string,
  reviews: CoachPublishPayload[]
): Promise<PublishArcResult> {
  const token = await getAuthToken();
  if (!token) {
    return { kind: "error", status: 401, message: "Sign in as a coach to publish." };
  }

  let res: Response;
  try {
    res = await fetch(`/api/v2/coach/arc/${encodeURIComponent(arcId)}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reviews: reviews.map((review) => ({
          session_id: review.sessionId,
          idempotency_key:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${review.sessionId}:${Date.now()}`,
          overall_message: review.overallMessage,
          feedback_items: review.feedbackItems,
          share_video: review.shareVideo,
        })),
      }),
    });
  } catch {
    return { kind: "error", status: 0, message: "Couldn't reach the server. Try again." };
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    // The BE's 409s are code-shaped (TAKES_NOT_SAVED / IDEAL_TEXT_NOT_APPROVED)
    // and may carry the human text under message/detail rather than error —
    // try each, then map the bare code, before the generic fallback.
    const firstString = (...vals: unknown[]): string | null => {
      for (const v of vals) if (typeof v === "string" && v.length > 0) return v;
      return null;
    };
    const codeCopy =
      body?.code === "TAKES_NOT_SAVED"
        ? "Save each recording's feedback first."
        : body?.code === "IDEAL_TEXT_NOT_APPROVED"
        ? "Verify the ideal text first."
        : null;
    const msg =
      firstString(body?.error, body?.message, body?.detail) ??
      codeCopy ??
      `Publish failed (HTTP ${res.status}).`;
    return { kind: "error", status: res.status, message: msg };
  }
  return {
    kind: "ok",
    takesPublished:
      typeof body?.takes_published === "number" ? body.takes_published : 0,
    deliveredAt: typeof body?.delivered_at === "string" ? body.delivered_at : null,
  };
}
