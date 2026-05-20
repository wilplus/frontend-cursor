import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";
import { proxyResponse } from "@/app/api/proxyResponse";

export const runtime = "nodejs";
export const maxDuration = 30;

export const dynamic = "force-dynamic";

/**
 * Body: { "checkout_session_id": "cs_..." } (from Stripe success_url ?session_id=)
 */
export async function POST(req: NextRequest) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 503 }
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(`${backend}/v2/homework/stripe/claim-checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body && typeof body === "object" ? body : {}),
    });
  } catch (e) {
    console.error("[homework/stripe/claim-checkout] upstream fetch failed", e);
    return NextResponse.json(
      {
        code: "BFF_UPSTREAM_UNREACHABLE",
        error:
          "Could not reach the API server. Set NEXT_PUBLIC_API_URL, NEXT_PUBLIC_BACKEND_URL, or BACKEND_URL to your Railway URL.",
      },
      { status: 502 }
    );
  }
  return proxyResponse(upstreamRes);
}
