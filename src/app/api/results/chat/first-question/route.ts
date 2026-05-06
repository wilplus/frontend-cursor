import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/results/chat/first-question?sourceSnippetId=...&intent=charisma|stress
 *
 * Contextual chat initialization for the retention loop.
 * When a user clicks "Understand your charisma" or "Release your stress" on a
 * snippet card, this endpoint generates the first AI question using the snippet's
 * transcript + admin comment as context.
 *
 * Proxies to: POST /v2/user/chat/first-question
 */
export async function POST(req: NextRequest) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Forward query params to backend
    const sourceSnippetId = req.nextUrl.searchParams.get("sourceSnippetId") || "";
    const intent = req.nextUrl.searchParams.get("intent") || "";

    const url = new URL(`${backend}/v2/user/chat/first-question`);
    if (sourceSnippetId) url.searchParams.set("sourceSnippetId", sourceSnippetId);
    if (intent) url.searchParams.set("intent", intent);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("Contextual chat first-question API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
