/**
 * Proxies PCM chunk to Flask for real-time metrics (dartboard). No Supabase writes.
 * Fixes 403 "new row violates row-level security policy" by not writing to Supabase.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";
import { useMockHomework, requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Sample-Rate, X-Seq, X-T-Ms, X-Chunk-Seq, X-Chunk-Start-Ms, X-Recording-Slot, X-Debug",
  "Access-Control-Max-Age": "86400",
};

function addCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Mock: derive voiced_ratio and pause_score from PCM so the glow and red pause-dot work (no backend).
 */
function stubChunkResponse(
  seq: number,
  body: ArrayBuffer
): { seq: number; voiced_ratio: number; pause_score: number } {
  let voiced_ratio = 0.9;
  let pause_score = 0.9;
  if (body.byteLength >= 2) {
    const view = new DataView(body);
    let sumSq = 0;
    const n = Math.floor(body.byteLength / 2);
    for (let i = 0; i < n; i++) sumSq += view.getInt16(i * 2, true) ** 2;
    const rms = Math.sqrt(sumSq / n);
    const SILENCE_RMS = 1200;
    if (rms < SILENCE_RMS) {
      voiced_ratio = 0.08;
      pause_score = 0.35;
    } else {
      pause_score = Math.min(1, 0.6 + rms / 25000);
    }
  }
  return { seq, voiced_ratio, pause_score };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (useMockHomework()) {
    const unauth = await requireAuth(request);
    if (unauth) return addCors(unauth);
    const body = await request.arrayBuffer();
    const seqHeader = request.headers.get("X-Chunk-Seq") ?? request.headers.get("X-Seq");
    const seq = seqHeader != null ? parseInt(seqHeader, 10) : 0;
    const res = NextResponse.json(stubChunkResponse(Number.isNaN(seq) ? 0 : seq, body));
    return addCors(res);
  }

  const token = await getV2AccessToken(request);
  if (!token) {
    return addCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const { sessionId } = await params;
  const backend = getBackendUrl();
  if (!backend) {
    return addCors(NextResponse.json({ error: "Backend not configured" }, { status: 503 }));
  }

  const body = await request.arrayBuffer();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
  };
  const forwardHeaders = [
    "X-Sample-Rate",
    "X-Seq",
    "X-T-Ms",
    "X-Chunk-Seq",
    "X-Chunk-Start-Ms",
    "X-Recording-Slot",
    "X-Debug",
  ];
  for (const name of forwardHeaders) {
    const value = request.headers.get(name);
    if (value != null) headers[name] = value;
  }

  const recordingSlot =
    request.nextUrl.searchParams.get("recording_slot") ||
    request.headers.get("X-Recording-Slot") ||
    "recording_1";
  const path = `${backend}/v2/homework/session/${sessionId}/recording-metrics-chunk?recording_slot=${encodeURIComponent(recordingSlot)}`;

  const res = await fetch(path, { method: "POST", headers, body });
  const data = await res.json().catch(() => ({}));
  const response = !res.ok
    ? NextResponse.json(data, { status: res.status })
    : NextResponse.json(data);
  return addCors(response);
}
