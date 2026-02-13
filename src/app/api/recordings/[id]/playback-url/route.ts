import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

interface Params {
  params: Promise<{ id: string }>;
}

/** GET fresh signed playback URL for a recording (owner-only). Use when report audio_url has expired. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const res = await proxyJson<{ audio_url: string }>(
    `/v2/recordings/${id}/playback-url`,
    { method: "GET" },
    req
  );
  return res;
}
