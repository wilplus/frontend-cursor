import { getAuthToken } from "@/lib/api/auth-client";
import { mapReadoutPayload, type ReadoutPayload } from "@/components/willab/readout";
import { mapReadoutSetup } from "@/components/willab/willabLastSetup";
import { type LabSessionContext } from "@/components/willab/LabOverlay";

/* -------------------------------------------------------------------------- */
/*  sessionReadout — re-read a session's durable coaching result               */
/*                                                                            */
/*  GET /api/v2/user/sessions/<id>/readout. Same envelope as the upload 201    */
/*  (A2) — { state, readout:{ snippets } } — plus, post-publish, canonical     */
/*  feedback_items and the separate coach_review summary/video layer.          */
/* -------------------------------------------------------------------------- */

export interface SessionReadout {
  state: string | null;
  readout: ReadoutPayload;
  /** FE-1 — top-level `setup` block (BE-1): the take's original intake context,
   *  used to restore setup for the next take when localStorage lost it. null
 *  until the BE ships it (safe-ahead). */
  setup: LabSessionContext | null;
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

  // The BE mirrors audit_paid TOP-LEVEL (sibling of "readout"); fold it into the
  // mapped payload so the arc-paid echo survives the body.readout extraction.
  // (The coach layer is unconditionally free now — no per-take withholding.)
  const readoutObj = {
    ...(body.readout && typeof body.readout === "object" ? body.readout : {}),
    ...("audit_paid" in body ? { audit_paid: body.audit_paid } : {}),
  };
  return {
    state: typeof body.state === "string" ? body.state : null,
    readout: mapReadoutPayload(readoutObj),
    setup: mapReadoutSetup(body.setup),
  };
}
