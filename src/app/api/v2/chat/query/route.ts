import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/chat/query
 *
 * Knowledge-base-backed Q&A endpoint for the post-onboarding chat
 * surface. After the user signs up and lands back on /chat, the
 * thread stays open as a persistent Q&A composer: any free-text
 * question they type goes here, gets answered against the master
 * document, and renders as a text bubble in the thread.
 *
 * Two wire shapes are accepted on this route (per FE Prompt 3 in the
 * stress-contrast series, compatibility contract C1):
 *
 *   1. application/json — the existing shape. Body is
 *      `{ question, history?, session_id? }`. Forwarded to backend
 *      verbatim with the same Content-Type.
 *
 *   2. multipart/form-data — new in BE-3. Body carries `question`,
 *      optional `history`, plus an `audio_file` blob with the raw
 *      mic capture for silent acoustic metrics. The backend extracts
 *      metrics from the audio and may return a `contrast: {...}`
 *      block on the response. Forwarded to backend as multipart
 *      (NOT re-encoded as JSON — the audio bytes need to land in
 *      the upstream's multipart parser intact).
 *
 * Content-Type is sniffed at the top of the handler and the body is
 * forwarded preserving its original encoding. The Authorization
 * header is rewritten from the user's session JWT (same as the JSON
 * path always did); credentials never leak through the multipart
 * body.
 *
 * Until backend BE-3 ships the multipart branch may 4xx — that's
 * expected and acceptable per the user's deployment plan. The JSON
 * path (today's traffic) is unaffected.
 */
export async function POST(req: NextRequest) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const url = `${backend}/v2/chat/query`;
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // Re-emit the FormData against the upstream URL. We re-build
      // the form instead of streaming the raw body because Node's
      // fetch needs to set its own multipart boundary; reusing the
      // inbound Content-Type header would carry the wrong boundary
      // marker and the upstream parser would 400.
      const inbound = await req.formData();
      const out = new FormData();
      for (const [key, value] of inbound.entries()) {
        out.append(key, value);
      }
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: out,
        cache: "no-store",
      });
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }

    // Default — JSON path. Unchanged from today (C1).
    const body = await req.json().catch(() => ({}));
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST /api/v2/chat/query error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "chat-query-v2",
      },
      { status: 500 }
    );
  }
}
