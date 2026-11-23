import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayLenient } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Took too long. Try again in a moment." } },
};

export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return failure(failures.unauthenticated);
  let body: FormData;
  try {
    body = await req.formData();
  } catch {
    return NextResponse.json({ code: "INVALID_MULTIPART", error: "Invalid multipart payload." }, { status: 400 });
  }
  return callBackend("/v2/chat/voice", {
    method: "POST", token, body, signal: AbortSignal.timeout(55_000), failures, relay: relayLenient(),
  });
}
