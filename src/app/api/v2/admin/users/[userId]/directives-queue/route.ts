import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * /api/v2/admin/users/[userId]/directives-queue
 *
 * Proxy for backend BE-3 (`feat(directives-queue/BE)`). User-level
 * coaching arc — replaces the legacy single-question override on the
 * user_context blob AND the per-snippet `final_human_next_questions[]`
 * pattern. See `src/services/api/directivesQueue.ts` for the client
 * shape and the matrix doc for the conversation-driver semantics.
 *
 * GET    — return current arc (`{rows: DirectiveRow[]}`, empty when
 *          no arc is queued).
 * POST   — replace the arc. Body: `{rows: [{position, intent_tag,
 *          question}, ...]}`. Idempotent at the row-array level;
 *          backend audits each replace.
 * DELETE — clear the arc; subsequent turns fall back to LLM-generated.
 *
 * Backend NOT shipped yet at the time this BFF lands — all three
 * methods will 4xx until `feat(directives-queue/BE)` deploys. The
 * legacy single-question override path on `/users/{id}/context`
 * continues to work in the meantime so the admin can still steer
 * conversations (just not via this UI yet).
 */

function backendUrl(userId: string): string | null {
  const backend = getBackendUrl();
  if (!backend) return null;
  return `${backend}/v2/admin/users/${encodeURIComponent(userId)}/directives-queue`;
}

async function withAuth(
  req: NextRequest,
  go: (token: string, url: string) => Promise<NextResponse>,
  params: { userId: string }
): Promise<NextResponse> {
  const url = backendUrl(params.userId);
  if (!url) {
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
  return go(token, url);
}

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  return withAuth(
    req,
    async (token, url) => {
      const upstream = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    },
    params
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  return withAuth(
    req,
    async (token, url) => {
      const body = await req.json().catch(() => ({}));
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
        cache: "no-store",
      });
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    },
    params
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  return withAuth(
    req,
    async (token, url) => {
      const upstream = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    },
    params
  );
}
