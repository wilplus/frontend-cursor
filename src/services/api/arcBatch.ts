import { getAuthToken } from "@/lib/api/auth-client";

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
  | { kind: "ideal_text_incomplete"; slidesPending: number[] }
  | { kind: "error"; status: number; message: string };

/** POST /v2/coach/arc/<id>/publish — deliver the full analysis (4 bubbles).
 *  409 IDEAL_TEXT_INCOMPLETE = the ideal text needs finishing/approval first
 *  (that ordering is intended). Other 409s (e.g. not all takes saved) surface
 *  as their BE message. */
export async function publishArc(arcId: string): Promise<PublishArcResult> {
  const token = await getAuthToken();
  if (!token) {
    return { kind: "error", status: 401, message: "Sign in as a coach to publish." };
  }

  let res: Response;
  try {
    res = await fetch(`/api/v2/coach/arc/${encodeURIComponent(arcId)}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { kind: "error", status: 0, message: "Couldn't reach the server. Try again." };
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (res.status === 409 && body?.code === "IDEAL_TEXT_INCOMPLETE") {
    const pending = Array.isArray(body.slides_pending)
      ? body.slides_pending.filter(
          (n): n is number => typeof n === "number" && Number.isFinite(n)
        )
      : [];
    return { kind: "ideal_text_incomplete", slidesPending: pending };
  }
  if (!res.ok) {
    const msg =
      (typeof body?.error === "string" && body.error) ||
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
