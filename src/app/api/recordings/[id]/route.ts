import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { GetRecordingResponse } from "@/lib/api/types";

interface Params {
  params: { id: string };
}

/**
 * Proxies to GET /v2/recordings/{id} (canonical). Pass-through 200/404/403.
 * Backward compatibility: if backend returns 404, try GET /recordings/{id} so
 * backends that only expose the legacy path still work until they add the V2 route.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const recordingId = params.id;
  const v2Res = await proxyJson<GetRecordingResponse>(`/v2/recordings/${recordingId}`, undefined, req);
  if (v2Res.status === 404) {
    const v1Res = await proxyJson<GetRecordingResponse>(`/recordings/${recordingId}`, undefined, req);
    return v1Res;
  }
  return v2Res;
}

