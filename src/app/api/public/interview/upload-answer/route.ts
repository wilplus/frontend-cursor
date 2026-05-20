import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

export const maxDuration = 30;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { code: "INVALID_MULTIPART", error: "Invalid multipart payload." },
      { status: 400 }
    );
  }

  const url = `${backend}/v2/public/interview/upload-answer`;

  // Forward the caller's Authorization header when present. The
  // backend uses it for the contextual-chat outcome-eval branch
  // (services/coaching_outcomes.py); guest uploads work without it.
  const proxyHeaders: Record<string, string> = {};
  const incomingAuth = req.headers.get("authorization");
  if (incomingAuth) {
    proxyHeaders.Authorization = incomingAuth;
  }

  let upstream: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    upstream = await fetch(url, {
      method: "POST",
      headers: proxyHeaders,
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { code: "TIMEOUT", error: "Upload timed out after 60 seconds." },
        { status: 504 }
      );
    }
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
    if (text.includes("<!doctype html>") || text.includes("<html")) {
      const status = upstream.status === 404 ? 404 : upstream.status || 500;
      return NextResponse.json(
        {
          code: status === 404 ? "NOT_FOUND" : "HTML_ERROR_RESPONSE",
          error: `Backend returned HTML (status ${upstream.status}).`,
        },
        { status }
      );
    }
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { code: "INVALID_RESPONSE", error: "Backend returned invalid JSON." },
        { status: 502 }
      );
    }
  }

  if (!upstream.ok) {
    const fallback = {
      code: `HTTP_${upstream.status}`,
      error: upstream.statusText || "Upload failed",
    };
    return NextResponse.json(json ?? fallback, { status: upstream.status });
  }

  return NextResponse.json(json, { status: upstream.status });
}
