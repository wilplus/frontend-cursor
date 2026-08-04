import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET / POST /api/v2/user/profile
 *
 * BFF proxy for the willab-beta one-time profile (§2). Verbatim pass-through.
 * @require_auth backend-side — unsigned first-run callers get 401 here and
 * fall back to the local profile cache (synced to the server at sign-up).
 *
 *   GET  200 { domain, goal, domain_vocabulary_default, is_coach, sex }
 *   POST { domain?, goal?, sex? }  200 { ...updated profile }
 *        domain ∈ {public_speaking, sales, executive_presence,
 *                  customer_service, interview_prep} → 422 otherwise (BE).
 *        sex ∈ {female, male, prefer_not_to_say} | null → 422 otherwise (BE).
 *
 * Write is POST (not PUT) per the BE contract, and it is PARTIAL — only the
 * keys present in the body are touched, so `{sex}` alone cannot clear
 * domain/goal. Text-only, never profiled-on.
 *
 * `sex` (BE PR #288) is an acoustic routing key for the voice-confidence
 * composite, not a demographic — see services/api/userProfile.ts. It passes
 * through verbatim in both directions and is never surfaced (AC-9).
 */
const UPSTREAM = "/v2/user/profile";

export async function GET() {
  return callBackend(UPSTREAM, { method: "GET" });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return callBackend(UPSTREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
  });
}
