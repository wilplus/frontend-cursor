import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

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

async function authed(req: NextRequest) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return {
      error: NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }
  const backend = getBackendUrl();
  if (!backend) {
    return {
      error: NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      ),
    };
  }
  return { token, backend };
}

function passthrough(upstream: Response, text: string) {
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          code: "UPSTREAM_NON_JSON",
          error: `Unexpected backend response (HTTP ${upstream.status}).`,
        },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }
  }
  return NextResponse.json(data, { status: upstream.status });
}

export async function GET(req: NextRequest) {
  const a = await authed(req);
  if ("error" in a) return a.error;

  let upstream: Response;
  try {
    upstream = await fetch(`${a.backend}${UPSTREAM}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${a.token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/user/profile — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Profile service unavailable." },
      { status: 502 }
    );
  }
  return passthrough(upstream, await upstream.text());
}

export async function POST(req: NextRequest) {
  const a = await authed(req);
  if ("error" in a) return a.error;

  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${a.backend}${UPSTREAM}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${a.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body || "{}",
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/user/profile — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Profile service unavailable." },
      { status: 502 }
    );
  }
  return passthrough(upstream, await upstream.text());
}
