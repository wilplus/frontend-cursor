import { NextRequest, NextResponse } from "next/server";
import {
  backendFetch,
  getAccessToken,
  BackendNotConfiguredError,
} from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// LibreOffice conversion can be slow (esp. the first, cold `soffice` warmup);
// abort below the platform cap and let the FE fall back to manual entry.
// Ordering (handoff §B): client abort < BFF abort (55s) < maxDuration (60s).
export const maxDuration = 60;
const BFF_ABORT_MS = 55_000;

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
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Expected a multipart upload." },
      { status: 400 }
    );
  }

  const token = await getAccessToken(); // optional

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_ABORT_MS);
  // A closed tab means nobody is waiting on the parse — stop the backend too.
  req.signal.addEventListener("abort", () => controller.abort());

  let upstream: Response;
  try {
    upstream = await backendFetch("/v2/lab/presentation/extract", {
      method: "POST",
      body: form,
      signal: controller.signal,
      token,
    });
  } catch (err) {
    if (err instanceof BackendNotConfiguredError) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }
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
