import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayAudio } from "@/app/api/_lib/backend";

type Params = { params: { turnId: string } };

export const runtime = "nodejs";
const turnId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: Params) {
  if (!turnId.test(params.turnId)) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const range = req.headers.get("range");
  const response = await callBackend("/v2/chat/voice/" + encodeURIComponent(params.turnId), {
    headers: range ? { Range: range } : undefined,
    relay: relayAudio,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!turnId.test(params.turnId)) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  return callBackend("/v2/chat/voice/" + encodeURIComponent(params.turnId), { method: "POST", body: form });
}
