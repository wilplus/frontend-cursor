import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { GetRecordingResponse } from "@/lib/api/types";

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const recordingId = params.id;
  const response = await proxyJson<GetRecordingResponse>(`/recordings/${recordingId}`);
  return response;
}

