import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

/**
 * POST /api/v2/internal/student-credits/lookup
 *
 * BFF proxy for the internal credits admin tool (FE-6 / BE-B). Body carries
 * `{ password, user_id | email }`; returns `{ user_id, credits }` for the
 * resolved user so the admin page can show the current balance before it
 * writes a new one. Password-gated on the BE (body password); this proxy adds
 * no auth of its own and relays the upstream status + body verbatim.
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
    upstream = await fetch(`${backend}/v2/internal/student-credits/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/internal/student-credits/lookup — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Credits service unavailable." },
      { status: 502 }
    );
  }

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
