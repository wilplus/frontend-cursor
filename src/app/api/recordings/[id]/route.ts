import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { GetRecordingResponse } from "@/lib/api/types";

interface Params {
  params: { id: string };
}

/** Proxies to GET /v2/recordings/{id} (canonical). Pass-through 200/404/403. */
export async function GET(req: NextRequest, { params }: Params) {
  return proxyJson<GetRecordingResponse>(`/v2/recordings/${params.id}`, undefined, req);
}
