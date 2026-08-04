import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

interface Params {
  params: { id: string };
}

/**
 * Fresh signed playback URL for a recording (owner-only). Proxies the
 * backend's GET /v2/recordings/{id}/playback-url — the successor of the
 * retired /recordings/{id}/audio-url. Response: { audio_url }.
 */
export async function GET(req: NextRequest, { params }: Params) {
  return proxyJson(`/v2/recordings/${params.id}/playback-url`, undefined, req);
}
