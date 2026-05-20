import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/results/[sessionId]/snippets
 *
 * Non-skipped snippets for a specific session, with metrics, admin
 * comments, transcripts, and audio URLs — ready for SnippetCard.
 *
 * Auth: bearer token. User can only view their own session.
 *
 * Routed through the Flask backend (service-role) instead of querying
 * Supabase directly because v2_sessions / charisma_snippets have RLS
 * enabled with no permissive policies for the authenticated role. The
 * previous direct-query version always returned NOT_FOUND for
 * freshly-claimed sessions because RLS hid the rows from the anon
 * client.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Sign-in required." },
      { status: 401 }
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  const id = encodeURIComponent(params.sessionId);

  let upstream: Response;
  try {
    // BE-3 stress-contrast is opt-in via ?include_contrast=true so the
    // backend skips the two extra metric reads for callers that don't
    // render the dashboard section. The reviewing UI is the only
    // consumer of /api/results/.../snippets, and it always wants the
    // contrast block when available — request it unconditionally.
    upstream = await fetch(
      `${backendUrl}/v2/user/results/${id}?include_contrast=true`,
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
    console.error("GET /api/results/[id]/snippets — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Snippets service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: Record<string, unknown> = {};
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

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  // The backend returns snippets only when results_published_at is set;
  // otherwise the field is missing/empty. Surface an explicit
  // `published` flag so the page can distinguish "session not yet
  // published" from "session published with zero snippets".
  const status = (data.status as string) || "processing";
  const snippets = Array.isArray(data.snippets) ? data.snippets : [];

  // Forward the optional session-wide `charisma_profile` aggregate
  // through to the client when the backend ships it. The dashboard
  // (<CharismaDashboard>) handles `null` by hiding itself entirely,
  // so older sessions / pre-feature backend versions that omit the
  // field stay rendered exactly as before. Coerce undefined → null
  // so the client gets a definitive answer either way.
  const charismaProfile =
    data.charisma_profile != null && typeof data.charisma_profile === "object"
      ? (data.charisma_profile as Record<string, unknown>)
      : null;

  return NextResponse.json(
    {
      status: "ok",
      published: status === "completed",
      snippets,
      charisma_profile: charismaProfile,
    },
    { status: 200 }
  );
}
