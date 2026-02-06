import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyBinary } from "@/lib/api/bff";
import { useMockHomework, requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

/** CORS headers so browser allows POST with custom headers (preflight) and credentials. */
function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("Origin");
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Chunk-Seq, X-Chunk-Start-Ms, X-Recording-Slot, X-Debug",
    "Access-Control-Allow-Credentials": "true",
  };
  if (origin) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function addCors(res: NextResponse, req: NextRequest): NextResponse {
  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function OPTIONS(_req: NextRequest) {
  return addCors(
    new NextResponse(null, { status: 204, headers: { "Content-Length": "0" } }),
    _req
  );
}

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
    if (unauth) return addCors(unauth, req);
    const body = await req.arrayBuffer();
    return addCors(
      NextResponse.json(stubChunkResponse(Number.isNaN(seq) ? 0 : seq, body)),
      req
    );
  }

  const path = `/v2/homework/session/${sessionId}/recording-metrics-chunk?recording_slot=${encodeURIComponent(recordingSlot)}`;
  const res = await proxyBinary(path, req);
  return addCors(res, req);
}
