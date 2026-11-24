import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

type Params = { params: { handoff: string[] } };
const UUID = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const ROUTE = new RegExp("^(?:calendar|inbox/" + UUID + "|projects/" + UUID + "/reviews(?:/" + UUID + ")?)$", "i");

async function relay(req: NextRequest, { params }: Params) {
  if (!ROUTE.test(params.handoff.join("/"))) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }
  const path = params.handoff.map(encodeURIComponent).join("/");
  const response = await callBackend("/v2/human-coach/" + path, req.method === "POST" ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
  } : { method: "GET" });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function GET(req: NextRequest, params: Params) {
  return relay(req, params);
}

export function POST(req: NextRequest, params: Params): Promise<NextResponse> {
  return relay(req, params);
}
