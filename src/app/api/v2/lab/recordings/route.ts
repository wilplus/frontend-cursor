import { NextRequest, NextResponse } from "next/server";
import {
  backendFetch,
  getAccessToken,
  BackendNotConfiguredError,
} from "@/app/api/_lib/backend";

export const runtime = "nodejs"; // edge can't stream a multipart body this size
export const dynamic = "force-dynamic";
// Without this Vercel kills the function at the plan default. A lab take is
// minutes of audio: the upload alone can exceed the default, and the analysis
// runs behind it. The handoff's full ordering wants this ABOVE the backend's
// 600s sync budget — but we deploy on Vercel Hobby BY DECISION (founder,
// 2026-08-04: no Pro upgrade, ever), where the fluid ceiling is 300 and a
// higher value REJECTS THE BUILD (see the events route's cap note). 300 is
// the permanent Vercel-side guard; the escape hatch for payloads that outrun
// it is NOT a plan change — it's routing the upload through Cloudflare
// (Worker/proxy) straight to the backend, bypassing this function entirely.
// Until that lands, an upload slower than BFF_ABORT_MS returns the §A2
// still-processing envelope (no session_id) and the take finishes server-side.
export const maxDuration = 300;
// Abort upstream slightly BEFORE Vercel kills us, so the client gets a real
// JSON error instead of a platform 504 with an HTML body.
const BFF_ABORT_MS = 280_000;

/**
 * POST /api/v2/lab/recordings
 *
 * BFF proxy for the willab Lab upload (§3.3). Multipart pass-through: STREAMS
 * the raw body + Content-Type (boundary preserved) to the backend rather than
 * buffering minutes of audio in function memory. Synchronous upstream —
 * returns 201 + the finished Readout, 202 (async daemon), 422 (min-content
 * gate), or 504 PROCESSING_TIMEOUT once the backend's sync budget is spent
 * (NOT a failure: audio stored, session row exists — the client polls the
 * readout, handoff §A2). PUBLIC / guest — auth is forwarded when present
 * (signed-in scoping) but never required here.
 *
 * Verbatim status + JSON pass-through so the FE client owns the envelope shape.
 */
const UPSTREAM = "/v2/lab/recordings";
const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";

export async function POST(req: NextRequest) {
  // Optional auth — the Lab upload is public/guest; forward the token if signed.
  const token = await getAccessToken();
  const contentType =
    req.headers.get("content-type") ?? "application/octet-stream";
  const guestOwner = req.headers.get(GUEST_OWNER_HEADER);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BFF_ABORT_MS);
  // Propagate the CLIENT's disconnect too: if the user closes the tab, there
  // is no reason to keep the backend working on a dead request.
  req.signal.addEventListener("abort", () => controller.abort());

  let upstream: Response;
  try {
    upstream = await backendFetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(guestOwner ? { [GUEST_OWNER_HEADER]: guestOwner } : {}),
      },
      body: req.body,
      duplex: "half", // required when streaming a request body
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
      // Same envelope + copy as the backend's own 504 (§A2). No session_id to
      // return from here — the backend never got to answer — so the client
      // shows the calm still-processing read instead of a failure.
      return NextResponse.json(
        {
          code: "PROCESSING_TIMEOUT",
          error:
            "That recording is taking longer than expected — it's still processing, check back shortly.",
        },
        { status: 504 }
      );
    }
    console.error("POST /api/v2/lab/recordings — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Lab service unavailable." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
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
