import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
// PDF text extraction can be slow on a cold worker; abort below the cap.
export const maxDuration = 60;

/**
 * POST /api/v2/explore/arc/[arcId]/context-document (X-1)
 *
 * BFF proxy — attach a background context document to the arc (multipart `file`:
 * PDF, or UTF-8 text/markdown). The BE parses + stores the text (never returned)
 * and answers { ok, pages, chars, truncated }. Status passes through so the FE
 * reads 400 INVALID_INPUT/NO_TEXT, 404, and 413 FILE_TOO_LARGE distinctly.
 *
 * GET returns { has_document, pages?, chars?, truncated?, filename? } — the
 * text is background-only and never sent to the client.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
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
  const arc = encodeURIComponent(params.arcId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/explore/arc/${arc}/context-document`,
      {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body: form,
        signal: controller.signal,
        cache: "no-store",
      }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { code: "UPSTREAM_TIMEOUT", error: "Reading the document took too long. Try again." },
        { status: 504 }
      );
    }
    console.error("POST context-document — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Upload service unavailable." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
  const text = await upstream.text();
  if (!text) return new NextResponse(null, { status: upstream.status });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 502 }
    );
  }
  const arc = encodeURIComponent(params.arcId);
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/explore/arc/${arc}/context-document`,
      {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error("GET context-document — fetch failed:", err);
    return NextResponse.json(
      { error: "Upload service unavailable." },
      { status: 502 }
    );
  }
  const text = await upstream.text();
  if (!text) return new NextResponse(null, { status: upstream.status });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
