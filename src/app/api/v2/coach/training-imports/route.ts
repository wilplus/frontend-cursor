import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";
import { backendFetch, BackendNotConfiguredError } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  /api/v2/coach/training-imports  →  BE /v2/coach/training-imports           */
/*                                                                            */
/*  POST — import ONE audio file into the training corpus (multipart).        */
/*  GET  — the corpus index, optionally filtered by ?user_id=.                */
/*                                                                            */
/*  COACH-ONLY data; authorization is enforced upstream                        */
/*  (require_admin_or_coach), so this proxy adds no gate of its own and passes */
/*  401/403 through verbatim. Nothing here touches the normal user's upload    */
/*  path (POST /v2/lab/recordings) — that lane is untouched by design (FE-4).  */
/*                                                                            */
/*  The POST budget is generous on purpose: the import runs Whisper plus the   */
/*  cutting pass inline, which is minutes of work on a long talk, not seconds. */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
// Abort upstream before Vercel kills the function so a long import returns
// JSON, not a platform 504 HTML page (handoff §B ordering:
// client abort < BFF abort < maxDuration).
const BFF_ABORT_MS = 280_000;

export async function POST(req: NextRequest) {
  try {
    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    let inbound: FormData;
    try {
      inbound = await req.formData();
    } catch {
      return NextResponse.json(
        { code: "INVALID_MULTIPART", error: "Invalid multipart payload." },
        { status: 400 }
      );
    }
    // Rebuilt rather than streamed: Node's fetch sets its own multipart
    // boundary, and reusing the inbound Content-Type would carry the wrong
    // one and 400 upstream. Every field is re-emitted verbatim — the BFF
    // never validates or reshapes the import.
    const out = new FormData();
    for (const [key, value] of inbound.entries()) out.append(key, value);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BFF_ABORT_MS);
    // A closed tab means nobody is waiting — stop the backend work too.
    req.signal.addEventListener("abort", () => controller.abort());

    let upstream: Response;
    try {
      upstream = await backendFetch("/v2/coach/training-imports", {
        method: "POST",
        body: out,
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
        // The import (Whisper + cutting pass) keeps running server-side; the
        // corpus index picks it up when it lands. Same envelope as the lab
        // upload's timeout (§A2) — a timeout is not a failure.
        return NextResponse.json(
          {
            code: "PROCESSING_TIMEOUT",
            error:
              "That recording is taking longer than expected — it's still processing, check back shortly.",
          },
          { status: 504 }
        );
      }
      console.error("coach_training_import.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Import service unavailable." },
        { status: 502 }
      );
    } finally {
      clearTimeout(timer);
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_training_import.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-training-imports-v1",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
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
    // Forwarded explicitly — nothing is passed through wholesale.
    const userId = req.nextUrl.searchParams.get("user_id");
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : "";

    let upstream: Response;
    try {
      upstream = await fetch(`${backend}/v2/coach/training-imports${qs}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
    } catch (err) {
      console.error("coach_training_imports.bff_thrown surface=fe-bff", err);
      return NextResponse.json(
        { code: "PROXY_ERROR", error: "Corpus index unavailable." },
        { status: 502 }
      );
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_training_imports.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-training-imports-v1",
      },
      { status: 500 }
    );
  }
}
