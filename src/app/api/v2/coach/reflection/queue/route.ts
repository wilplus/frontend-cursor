import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/reflection/queue
 *
 * BFF proxy for the Reflection Game's BLIND clip-verification queue (F2 §1d).
 * Voted clips awaiting a coach verdict, oldest vote first.
 *
 * The upstream payload is audio + transcript ONLY — no machine flag, no
 * provenance, no user vote, no user identity — and this proxy adds nothing,
 * because the blindness IS the design: a coach who can see the model's guess
 * or the student's answer is no longer an independent third judgement, and
 * the agreement matrix built from it would be worthless.
 *
 * Queue PRIORITY (founder decision): text verification outranks clip
 * verification. That is enforced by surface ordering — render this queue
 * BELOW text-verification work, never above it.
 *
 * Authorization is server-enforced upstream (`require_admin_or_coach`); a
 * non-coach gets 403 and the client renders nothing.
 *
 *   200 { clips: [{ clip_id, audio_ref, start_offset_ms, duration_ms,
 *                   transcript }] }
 *   401 / 403 — not a coach · 502 — backend unavailable
 */
export async function GET() {
  return callBackend("/v2/coach/reflection/queue", { method: "GET" });
}
