import type { NextRequest } from "next/server";
import { proxyBinary } from "@/lib/api/bff";
import { useMockHomework, requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

/**
 * Mock: derive voiced_ratio and pause_score from PCM so the glow and red pause-dot work.
 * PCM16LE: 8000 bytes = 4000 int16. Low RMS → silence; high RMS → speech.
 * For silence we return voiced_ratio < 0.15 so the frontend can show the red "pause detected" dot (after speech).
 */
function stubChunkResponse(seq: number, body: ArrayBuffer): { seq: number; voiced_ratio: number; pause_score: number } {
  let voiced_ratio = 0.9;
  let pause_score = 0.9;

  if (body.byteLength >= 2) {
    const view = new DataView(body);
    let sumSq = 0;
    const n = Math.floor(body.byteLength / 2);
    for (let i = 0; i < n; i++) {
      const s = view.getInt16(i * 2, true);
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / n);
    // Silence: RMS typically < ~1000; speech often 2000–15000+ (int16)
    const SILENCE_RMS = 1200;
    if (rms < SILENCE_RMS) {
      voiced_ratio = 0.08; // < 0.15 so frontend treats as pause → red dot (when we've already had speech)
      pause_score = 0.35;  // dim glow when we do update from a previous speech chunk
    } else {
      voiced_ratio = 0.9;
      pause_score = Math.min(1, 0.6 + (rms / 25000));
    }
  }

  return { seq, voiced_ratio, pause_score };
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
  const seqHeader = req.headers.get("X-Chunk-Seq") ?? req.headers.get("X-Seq");
  const seq = seqHeader !== null ? parseInt(seqHeader, 10) : 0;

  if (useMockHomework()) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    const body = await req.arrayBuffer();
    return Response.json(stubChunkResponse(Number.isNaN(seq) ? 0 : seq, body));
  }

  const path = `/v2/homework/session/${sessionId}/recording-metrics-chunk?recording_slot=${encodeURIComponent(recordingSlot)}`;
  return proxyBinary(path, req);
}
