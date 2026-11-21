import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Authentication required." } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Something went wrong on our end." } },
};

/** POST /v2/experiments/sessions/<id>/takes. Multipart audio, prompt_id,
 *  tag, and self_rating. The user's session token is forwarded. */
export async function POST(req: NextRequest, context: { params: { sessionId: string } }) {
  const token = await getAccessToken();
  if (!token) return failure(FAILURES.unauthenticated!);
  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch {
    return NextResponse.json({ code: "INVALID_MULTIPART", error: "Invalid multipart payload." }, { status: 400 });
  }
  const out = new FormData();
  for (const [key, value] of inbound.entries()) out.append(key, value);
  const id = encodeURIComponent(context.params.sessionId);
  const response = await callBackend(`/v2/experiments/sessions/${id}/takes`, {
    method: "POST",
    body: out,
    token,
    failures: FAILURES,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
