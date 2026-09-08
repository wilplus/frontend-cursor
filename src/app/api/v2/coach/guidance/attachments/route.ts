import { NextRequest, NextResponse } from "next/server";
import {
  backendFetch,
  BackendNotConfiguredError,
} from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch {
    return NextResponse.json({ code: "INVALID_MULTIPART" }, { status: 400 });
  }
  const outbound = new FormData();
  for (const [key, value] of inbound.entries()) outbound.append(key, value);
  let upstream: Response;
  try {
    upstream = await backendFetch("/v2/coach/guidance/attachments", {
      method: "POST",
      body: outbound,
    });
  } catch (error) {
    if (error instanceof BackendNotConfiguredError) {
      return NextResponse.json({ code: "BACKEND_UNAVAILABLE" }, { status: 502 });
    }
    return NextResponse.json({ code: "PROXY_ERROR" }, { status: 502 });
  }
  return NextResponse.json(await upstream.json().catch(() => ({})), {
    status: upstream.status,
  });
}
