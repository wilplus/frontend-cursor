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
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { code: "IDEMPOTENCY_KEY_REQUIRED" },
      { status: 400 },
    );
  }
  const outbound = new FormData();
  for (const [key, value] of inbound.entries()) outbound.append(key, value);
  try {
    const upstream = await backendFetch(
      "/v2/coach/guidance/exercise-drafts",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: outbound,
      },
    );
    return NextResponse.json(await upstream.json().catch(() => ({})), {
      status: upstream.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: error instanceof BackendNotConfiguredError
          ? "BACKEND_UNAVAILABLE"
          : "PROXY_ERROR",
      },
      { status: 502 },
    );
  }
}
