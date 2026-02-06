import type { NextRequest } from "next/server";
import { proxyBinary } from "@/lib/api/bff";
import { useMockHomework, requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

/** Stub metrics when backend is not used (mock homework mode). Pause-only. */
function stubChunkResponse(seq: number) {
  return {
    seq,
    voiced_ratio: 0.9,
    pause_score: 0.9,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const recordingSlot =
    req.nextUrl.searchParams.get("recording_slot") ||
    req.headers.get("X-Recording-Slot") ||
    "recording_1";
  const seqHeader = req.headers.get("X-Chunk-Seq");
  const seq = seqHeader !== null ? parseInt(seqHeader, 10) : 0;

  if (useMockHomework()) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    await req.arrayBuffer(); // consume body
    return Response.json(stubChunkResponse(Number.isNaN(seq) ? 0 : seq));
  }

  const path = `/v2/homework/session/${sessionId}/recording-metrics-chunk?recording_slot=${encodeURIComponent(recordingSlot)}`;
  return proxyBinary(path, req);
}
