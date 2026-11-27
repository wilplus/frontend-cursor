import { type NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const response = relayLenient();

/** Act it (backend N708): the founder's acted recordings and their names. */
export async function GET() {
  const upstream = await callBackend("/v2/user/speaking-patterns/acted", { method: "GET", relay: response });
  upstream.headers.set("Cache-Control", "no-store");
  return upstream;
}

/** One acted recording (multipart: audio_file, state, pattern, language). */
export async function POST(request: NextRequest) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ code: "INVALID_ACTED" }, { status: 400 });
  }
  return callBackend("/v2/user/speaking-patterns/acted", {
    method: "POST", body: form, signal: AbortSignal.timeout(55_000), relay: response,
  });
}
