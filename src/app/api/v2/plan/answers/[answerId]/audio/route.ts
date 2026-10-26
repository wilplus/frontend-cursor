import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, type Relay } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** One of the speaker's own voice answers, played back (the key line's "How
 *  you said it", and their voice bubbles). The audio passes through as it
 *  came; an error stays JSON. */
const RELAY: Relay = async (upstream) => {
  const contentType = upstream.headers.get("Content-Type") || "";
  if (upstream.ok && contentType && !contentType.includes("application/json")) {
    const out = new NextResponse(await upstream.arrayBuffer(), { status: upstream.status });
    out.headers.set("Content-Type", contentType);
    out.headers.set("Cache-Control", "private, max-age=3600");
    return out;
  }
  const text = await upstream.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { code: "UPSTREAM_NON_JSON", error: `Unexpected backend response (HTTP ${upstream.status}).` };
  }
  return NextResponse.json(data, { status: upstream.ok ? 502 : upstream.status });
};

export async function GET(_req: NextRequest, context: { params: { answerId: string } }): Promise<NextResponse> {
  const id = encodeURIComponent(context.params.answerId);
  return callBackend(`/v2/plan/answers/${id}/audio`, { method: "GET", relay: RELAY });
}
