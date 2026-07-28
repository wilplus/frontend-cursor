import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

/**
 * POST /api/v2/internal/journal/image/generate
 *
 * BFF passthrough for the Journal CMS cover generator: the backend writes an
 * image brief from the post, draws it, and stores the file in the same R2
 * bucket a manually uploaded cover already uses.
 *
 * Password-gated on the BACKEND (the admin password rides in the body), so this
 * proxy adds no auth of its own and relays the upstream status + body verbatim.
 * The CMS needs the distinction: 400 IMAGE_REJECTED (reword the brief) vs 400
 * INVALID_INPUT, 401 (wrong password), 503 DISABLED (not retryable) vs 503
 * V2_ERROR (retryable).
 *
 * TIMEOUTS ARE THE WHOLE POINT OF THIS FILE, exactly as in the sibling
 * community/generate. A route handler otherwise inherits the platform default
 * (10-15s on Vercel). Left alone this would 504 on a request the backend went
 * on to complete — and unlike a text generation, that failure costs a paid
 * image that exists in storage with nobody holding its URL. So: a generous
 * maxDuration, and an abort just under it that reports the timeout honestly.
 *
 * 180 is measured, not guessed. The original handoff said 10-30s, but a STEERED
 * REGENERATE against the live API measured 98s — the brief writer re-reads the
 * previous brief before the draw even starts, so the slowest path is exactly
 * the interaction this feature exists for. 60 would 504 on it. This route
 * therefore sits well above every other slow route in the app (all 60) and
 * REQUIRES a Vercel plan whose ceiling exceeds 60s; on Hobby it is capped there
 * and a long regenerate will still fail.
 *
 * The password is never logged.
 */
export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // Just under maxDuration, so the abort wins the race and the founder gets the
  // honest message below instead of an opaque platform 504.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 175_000);

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/internal/journal/image/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        {
          // The draw may well have finished server-side, so say so: the strip
          // is server-held and a reopen will show the image if it landed.
          code: "UPSTREAM_TIMEOUT",
          error:
            "Drawing took too long. It may still have finished, reopen the post to check before drawing again.",
        },
        { status: 504 }
      );
    }
    console.error(
      "POST /api/v2/internal/journal/image/generate — fetch failed:",
      err
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Journal service unavailable." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if ([204, 205, 304].includes(upstream.status)) {
    return new NextResponse(null, { status: upstream.status });
  }
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
