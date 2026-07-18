import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  reRecordSnippet — DELIVERY_STARS re-record (safe-ahead of the BE)          */
/*                                                                            */
/*  A delivery star's action is a per-snippet RE-RECORD: the user reads just   */
/*  that fragment again, applying the feedback (slower / with more emphasis /  */
/*  a breath before it), and the BE re-transcribes + re-analyzes that one      */
/*  snippet and folds the improved take into the living ideal text.            */
/*                                                                            */
/*  PINNED CONTRACT (not yet built on the BE — this is the FE-defined shape    */
/*  the BE ticket must match):                                                 */
/*    POST /v2/explore/arc/<arc_id>/snippet/<snippet_id>/re-record             */
/*    multipart:  audio_file (webm/opus, required)                             */
/*                duration_seconds (optional)                                  */
/*    200 → the snippet is re-analyzed; the ideal text bumps a version.        */
/*  Everything degrades: a 404 (endpoint absent under the flag) or any non-2xx */
/*  returns ok:false, and the modal shows a soft retry line — never a crash.   */
/* -------------------------------------------------------------------------- */

export async function reRecordSnippet(
  arcId: string,
  snippetId: string,
  audio: Blob,
  durationSec: number
): Promise<{ ok: boolean }> {
  try {
    const form = new FormData();
    form.append("audio_file", audio, "snippet.webm");
    if (Number.isFinite(durationSec) && durationSec > 0) {
      form.append("duration_seconds", String(Math.round(durationSec)));
    }
    // Cookie-session first; attach a bearer only when we have one (a guest on
    // the readout has none — the endpoint can still accept a guest re-record
    // scoped to the session, mirroring the other explore routes).
    const headers: Record<string, string> = {};
    const token = await getAuthToken().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/snippet/${encodeURIComponent(
        snippetId
      )}/re-record`,
      { method: "POST", body: form, headers, credentials: "include" }
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
