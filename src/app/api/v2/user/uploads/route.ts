import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/user/uploads
 *
 * User-facing file upload — accepts pre-recorded audio (.mp3, .wav,
 * .m4a) or video (.mp4, .mov) blobs that the user wants the human
 * coach to review alongside their live-mic answers. Proxies the
 * multipart body straight through to backend POST /v2/user/uploads,
 * which persists to Cloudflare R2 and links the row to the current
 * session for the admin Files tab.
 *
 * Body: multipart/form-data
 *   - file:        the audio/video Blob
 *   - session_id:  optional UUID of the session this file belongs to
 *   - filename:    optional original filename (fallback: file.name)
 *
 * Success 200:
 *   { status: "ok", upload_id, file_url, filename, content_type,
 *     size_bytes, session_id }
 *
 * 401 UNAUTHENTICATED  — sign-in required
 * 413 FILE_TOO_LARGE   — backend cap (typically 100 MB)
 * 415 UNSUPPORTED_TYPE — content type not in the allow-list
 * 5xx                  — backend unavailable
 */
export const runtime = "nodejs";
export const maxDuration = 30;

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

    // Re-stream the multipart body verbatim. We can't JSON-roundtrip
    // a file, and rebuilding the FormData server-side via
    // req.formData() then re-encoding would double the memory hit on
    // large videos. Forwarding the raw stream lets the Flask backend
    // parse it natively and stream straight into R2.
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return NextResponse.json(
        { code: "BAD_REQUEST", error: "Expected multipart/form-data body." },
        { status: 400 }
      );
    }

    const upstream = await fetch(`${backend}/v2/user/uploads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": contentType,
      },
      body: req.body,
      // Required by undici when forwarding a streamed body.
      duplex: "half",
      cache: "no-store",
    } as RequestInit & { duplex: "half" });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST /api/v2/user/uploads error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "user-uploads-v1",
      },
      { status: 500 }
    );
  }
}
