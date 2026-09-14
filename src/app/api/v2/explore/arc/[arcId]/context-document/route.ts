import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

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

const POST_FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Upload service unavailable." } },
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Reading the document took too long. Try again." } },
};
const GET_FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Upload service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  // Sign-in is checked before the body is read, as it always was.
  const token = await getAccessToken();
  if (!token) return failure(POST_FAILURES.unauthenticated!);
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
  try {
    return await callBackend(`/v2/explore/arc/${arc}/context-document`, {
      method: "POST",
      body: form,
      signal: controller.signal,
      token,
      failures: POST_FAILURES,
      relay: RELAY,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  return callBackend(`/v2/explore/arc/${arc}/context-document`, {
    method: "GET",
    failures: GET_FAILURES,
    relay: RELAY,
  });
}
