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
 * community/generate. Drawing takes 10-30s and the brief adds a second or two,
 * while a route handler otherwise inherits the platform default (10-15s on
 * Vercel). Left alone this would 504 on a request the backend went on to
 * complete — and unlike a text generation, that failure costs a paid image that
 * exists in storage with nobody holding its URL. So: a generous maxDuration,
 * and an abort just under it that reports the timeout honestly.
 *
 * 60 is deliberate rather than higher: it is the ceiling on Vercel's Hobby
 * plan, and every other slow route in this app already sits there. The abort at
 * 55s still leaves ~23s of headroom over the worst documented draw.
 *
 * The password is never logged.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

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
