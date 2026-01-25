import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  return proxyJson(`/recordings/${params.id}/audio-url`);
}

