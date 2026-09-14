import "server-only";
import { NextRequest, NextResponse } from "next/server";
import type { ListRecordingsResponse } from "@/lib/api/types";
import { callBackend, LEGACY_FAILURES, relayLegacy } from "@/app/api/_lib/backend";



// proxyJson (src/lib/api/bff.ts, deleted in Q-A8) answered with its own
// envelope and a 30 s budget; both are kept verbatim via LEGACY_FAILURES and
// relayLegacy until the copy is unified.
export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.toString();
  const path = `/user/recordings${search ? `?${search}` : ""}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let response: NextResponse;
  try {
    response = await callBackend(path, {
      method: "GET",
      signal: controller.signal,
      failures: LEGACY_FAILURES,
      relay: relayLegacy(path),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return response;
  }

  try {
    const backendData = await response.json();

    const transformedData: ListRecordingsResponse = {
      items: (backendData.recordings || []).map((rec: any) => ({
        id: rec.id,
        created_at: rec.created_at,
        duration: rec.duration_seconds || rec.duration || 0,
      })),
      limit: backendData.limit || 10,
      offset: backendData.offset || 0,
      total: backendData.total,
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error("[API /user/recordings] Error transforming response:", error);
    return response;
  }
}
