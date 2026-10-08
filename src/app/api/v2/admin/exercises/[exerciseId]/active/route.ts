import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * PUT /api/v2/admin/exercises/<exerciseId>/active → BE /v2/admin/exercises/<id>/active
 *
 * Retire an exercise from the library, or bring it back (coach panel lock
 * CP3 A, the founder's Library page; build plan D-CP-21). Body {active: bool}.
 * Verbatim pass-through: the backend is founder-only (require_founder) and
 * answers 409 NEEDS_VIDEO or POST_NOT_PUBLISHED when an exercise cannot come
 * back yet; the page shows its sentence as sent.
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Library unavailable." } },
};
const RELAY = relayLenient();

export async function PUT(req: NextRequest, { params }: { params: { exerciseId: string } }) {
  try {
    const exerciseId = params.exerciseId;
    if (!exerciseId) {
      return NextResponse.json({ code: "INVALID_INPUT", error: "No exercise id." }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    return await callBackend(`/v2/admin/exercises/${encodeURIComponent(exerciseId)}/active`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`admin_exercise_active.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`, err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}`, bff_revision: "admin-exercise-active-v1" },
      { status: 500 },
    );
  }
}
