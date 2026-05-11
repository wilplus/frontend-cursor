import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/internal/publish-session-results
 *
 * Admin endpoint that flips a session's results_published_at and emails
 * the user a "Snippets Ready" notification. Proxies to backend
 * POST /v2/internal/publish-session-results.
 *
 * Previously used `process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"`
 * directly — that env var is intentionally NOT set on Vercel (we use
 * BACKEND_URL_INTERNAL / BACKEND_URL via getBackendUrl()), so every
 * publish from production fell back to localhost:5000 and 500'd with a
 * generic `{code: "ERROR", error: "Internal server error"}`. Same fix
 * pattern we applied to the comment BFF in 3cfa79f.
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

    const body = await req.json().catch(() => ({}));

    const response = await fetch(
      `${backend}/v2/internal/publish-session-results`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    // Self-identifying tag + surfaced error so a 500 here is
    // diagnosable in one network capture rather than a guessing game.
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("Publish session results API error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "publish-session-results-4c09794+",
      },
      { status: 500 }
    );
  }
}
