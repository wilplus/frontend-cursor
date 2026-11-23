import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Authentication required." } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Something went wrong on our end." } },
};

/** POST /v2/experiments/sessions. JSON consent, or multipart when a
 *  one-page case is attached. The user's session token is forwarded. */
export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return failure(FAILURES.unauthenticated!);
  const type = req.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    let inbound: FormData;
    try {
      inbound = await req.formData();
    } catch {
      return NextResponse.json({ code: "INVALID_MULTIPART", error: "Invalid multipart payload." }, { status: 400 });
    }
    const out = new FormData();
    for (const [key, value] of inbound.entries()) out.append(key, value);
    const response = await callBackend("/v2/experiments/sessions", { method: "POST", body: out, token, failures: FAILURES });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  const text = await req.text();
  const response = await callBackend("/v2/experiments/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: text || "{}",
    token,
    failures: FAILURES,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
