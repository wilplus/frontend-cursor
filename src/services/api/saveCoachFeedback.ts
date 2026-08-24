import { getAuthToken } from "@/lib/api/auth-client";
import type { PublishInput } from "./publishWillabSession";

/* -------------------------------------------------------------------------- */
/*  saveCoachFeedback — the per-take Save checkpoint (delivery layer)          */
/*                                                                            */
/*  POST /v2/coach/sessions/<id>/save-feedback — marks this take's coach        */
/*  drafts as a SAVED checkpoint (coach_feedback_saved_at), NOT delivered.      */
/*  Carries the exact payload shape of the old per-session publish so the       */
/*  coach's local edits (notes / surfaced snapshot) persist with the            */
/*  checkpoint. Delivery only happens at the arc-level "Save and Publish full   */
/*  analysis" once all 3 takes are saved + the ideal text approved.             */
/* -------------------------------------------------------------------------- */

export async function saveCoachFeedback(
  input: PublishInput
): Promise<{ ok: boolean; message?: string }> {
  const token = await getAuthToken();
  if (!token) return { ok: false, message: "Not signed in." };

  // Paragraph feedback is persisted through snippets[] as canonical draft
  // items. The take-level summary is a separate scalar, never a second
  // feedback payload.
  const body = {
    session_id: input.sessionId,
    overall_message: input.overallMessage,
    ...(input.snippets ? { snippets: input.snippets } : {}),
  };

  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(input.sessionId)}/save-feedback`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  } catch {
    return { ok: false, message: "Network error. Try again." };
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { error?: string } | null;
    return {
      ok: false,
      message: b?.error ?? `Couldn't save (HTTP ${res.status}).`,
    };
  }
  return { ok: true };
}
