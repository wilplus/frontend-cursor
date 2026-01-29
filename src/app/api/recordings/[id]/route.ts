import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { GetRecordingResponse } from "@/lib/api/types";

interface Params {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  const recordingId = params.id;
  return proxyJson<GetRecordingResponse>(`/recordings/${recordingId}`, undefined, req);
}

