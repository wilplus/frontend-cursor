import { getAuthToken } from "@/lib/api/auth-client";
import { mapReadoutPayload, type ReadoutPayload } from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  sessionReadout — re-read a session's Readout (§3.0 park / §6 insights)     */
/*                                                                            */
/*  GET /api/v2/user/sessions/<id>/readout. Same envelope as the upload 201    */
/*  (A2) — { state, readout:{ snippets } } — plus, post-publish, each snippet's │
/*  coach{note,tag} + insights_payload.overall_message (mapped by              */
/*  mapReadoutPayload). Reading it also triggers the BE library ingest (§3.11).*/
/* -------------------------------------------------------------------------- */

export interface SessionReadout {
  state: string | null;
  readout: ReadoutPayload;
}

export async function fetchSessionReadout(
  sessionId: string
): Promise<SessionReadout | null> {
  const token = await getAuthToken();
  if (!token) return null;

  let res: Response;
  try {
    res = await fetch(
      `/api/v2/user/sessions/${encodeURIComponent(sessionId)}/readout`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return null;

  // The BE mirrors audit_paid + human_feedback_visible TOP-LEVEL (siblings of
  // "readout"); fold them into the mapped payload so the take-aware gating
  // survives the body.readout extraction.
  const readoutObj = {
    ...(body.readout && typeof body.readout === "object" ? body.readout : {}),
    ...("audit_paid" in body ? { audit_paid: body.audit_paid } : {}),
    ...("human_feedback_visible" in body
      ? { human_feedback_visible: body.human_feedback_visible }
      : {}),
  };
  return {
    state: typeof body.state === "string" ? body.state : null,
    readout: mapReadoutPayload(readoutObj),
  };
}
