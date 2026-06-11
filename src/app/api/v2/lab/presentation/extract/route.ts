import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
// LibreOffice conversion can be slow (esp. the first, cold `soffice` warmup);
// abort below the platform cap and let the FE fall back to manual entry.
export const maxDuration = 60;

/**
 * POST /api/v2/lab/presentation/extract
 *
 * BFF proxy for slide-deck parsing — multipart `file` (pptx | pdf). The BE
 * converts the deck to ONE served PDF and returns
 *   { presentation_ref, slides:[{title, body}], slide_count, source, warnings }.
 * Guest-friendly: the token is forwarded when present (for scoping) but never
 * required, same as the Lab upload. Upstream status + body pass through
 * unchanged so the client can read 413 / 415 / 422 distinctly.
 */
export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Expected a multipart upload." },
      { status: 400 }
    );
  }

  const token = await getV2AccessToken(req); // optional
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/lab/presentation/extract`, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        {
          code: "UPSTREAM_TIMEOUT",
          error: "Reading the deck took too long. Add your slides manually.",
        },
        { status: 504 }
      );
    }
    console.error("POST /api/v2/lab/presentation/extract — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Deck parser unavailable." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await upstream.text();
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
