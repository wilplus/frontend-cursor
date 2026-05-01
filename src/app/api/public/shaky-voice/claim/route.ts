import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";

  let body: { guest_session_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  if (!body.guest_session_id) {
    return NextResponse.json(
      { code: "MISSING_FIELD", error: "guest_session_id is required." },
      { status: 400 }
    );
  }

  const url = `${backend}/v2/public/shaky-voice/claim`;

  let upstream: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ guest_session_id: body.guest_session_id }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    return NextResponse.json(
      {
        code: "FETCH_ERROR",
        error: err instanceof Error ? err.message : "Failed to reach backend.",
      },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { code: "INVALID_RESPONSE", error: "Backend returned invalid JSON." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(json, { status: upstream.status });
}
