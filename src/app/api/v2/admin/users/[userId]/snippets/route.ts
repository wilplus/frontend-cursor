import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/admin/users/[userId]/snippets
 *
 * Admin endpoint to fetch all snippets for a specific user.
 * Proxies to backend GET /v2/admin/users/<user_id>/snippets.
 *
 * Uses the shared getBackendUrl() helper. The previous version read
 * `process.env.NEXT_PUBLIC_BACKEND_URL` directly with a localhost
 * fallback — that variable isn't set on Vercel (we use
 * BACKEND_URL_INTERNAL / BACKEND_URL there for security), so the BFF
 * was hitting localhost and returning 500 to every admin page load.
 * This was causing the snippet panel to render empty even when rows
 * existed in the DB.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
      { status: 401 }
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    console.error("GET /api/v2/admin/users/[id]/snippets — backend URL not configured");
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  const limit = req.nextUrl.searchParams.get("limit") || "100";
  const offset = req.nextUrl.searchParams.get("offset") || "0";
  const userId = encodeURIComponent(params.userId);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/v2/admin/users/${userId}/snippets?limit=${limit}&offset=${offset}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error("GET /api/v2/admin/users/[id]/snippets — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Snippet service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      {
        code: "UPSTREAM_NON_JSON",
        error: `Unexpected backend response (HTTP ${upstream.status}).`,
      },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
