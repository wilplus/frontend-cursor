import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

/**
 * POST /api/v2/internal/student-credits/set
 *
 * BFF proxy for the internal credits admin tool (FE-6 / BE-B). Body carries
 * `{ password, user_id | email, credits }`; the password (not a header) gates
 * the endpoint on the BE so a plain browser form can drive it. This proxy adds
 * no auth of its own — it forwards the JSON body verbatim and relays the
 * upstream status + body, so the BE stays the single source of truth for the
 * password check (503 if unset, 401 if wrong) and the balance write.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const body = await req.json().catch(() => ({}));

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/internal/student-credits/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/internal/student-credits/set — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Credits service unavailable." },
      { status: 502 }
    );
  }

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
