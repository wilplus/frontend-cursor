import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

export const runtime = "nodejs";
/**
 * Vercel default function timeout is 10s. The upstream LLM call
 * (gpt-4o on a cold first turn with the full
 * longitudinal + baseline_summary + conversation_summary augmentation)
 * can legitimately take 8-15s. Bumping to 30s gives Railway+OpenAI
 * the headroom without going into "user thinks the page is broken"
 * territory.
 */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const url = `${backend}/v2/public/interview/next-question`;

  // Hard 25s upstream-fetch budget (5s headroom under maxDuration so
  // the abort fires BEFORE Vercel kills the lambda — that's the
  // difference between the user seeing our actionable error JSON vs
  // Vercel's generic "Application failed to respond" 502).
  let upstream: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        {
          code: "UPSTREAM_TIMEOUT",
          error:
            "The coach took too long to think. Refresh to retry — if " +
            "this keeps happening, backend logs will show which call hung.",
        },
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
