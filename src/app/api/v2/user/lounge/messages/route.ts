import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET / POST / DELETE /api/v2/user/lounge/messages
 *
 * BFF proxy for the willab-beta Lounge persistence store (`lounge_messages`,
 * BE shipped). Verbatim pass-through so the backend's envelopes reach the
 * FE glue unchanged. @require_auth backend-side.
 *
 *   GET  ?limit=50&before=<iso8601>
 *        200 { messages:[{id,client_id,role,kind,body,metadata,client_created_at}],
 *              has_more, oldest_cursor }   // ASC by client_created_at
 *        400 INVALID_INPUT on malformed `before`; soft-fails to an empty page
 *
 *   POST { messages:[{client_id,role,kind,body,metadata?,client_created_at}] }
 *        200 { messages:[...persisted rows w/ server id] }
 *        idempotent on (user_id, client_id); batch ceiling 200 → 422 if exceeded
 *
 *   DELETE  204  // clears the whole thread (§3.14 user-deletable)
 *
 * Text-only, never audio, never the coach packet, never profiled.
 */
const UPSTREAM = "/v2/user/lounge/messages";

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

  const search = new URLSearchParams();
  const limit = req.nextUrl.searchParams.get("limit");
  const before = req.nextUrl.searchParams.get("before");
  if (limit) search.set("limit", limit);
  if (before) search.set("before", before);
  const qs = search.toString();

  let upstream: Response;
  try {
    upstream = await fetch(`${a.backend}${UPSTREAM}${qs ? `?${qs}` : ""}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${a.token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/user/lounge/messages — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Lounge service unavailable." },
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
    console.error("POST /api/v2/user/lounge/messages — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Lounge service unavailable." },
      { status: 502 }
    );
  }
  return passthrough(upstream, await upstream.text());
}

export async function DELETE(req: NextRequest) {
  const a = await authed(req);
  if ("error" in a) return a.error;

  let upstream: Response;
  try {
    upstream = await fetch(`${a.backend}${UPSTREAM}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${a.token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("DELETE /api/v2/user/lounge/messages — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Lounge service unavailable." },
      { status: 502 }
    );
  }
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  return passthrough(upstream, await upstream.text());
}
