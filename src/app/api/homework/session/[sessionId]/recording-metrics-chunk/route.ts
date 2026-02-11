/**
 * No-op BFF route for recording-metrics-chunk.
 * Real-time wheel is client-side only (useRealtimeStrengthPace); this endpoint is not used by current app code.
 * Responds with 204 so any old/cached client that still calls it gets a success and stops retrying.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  void params;
  return new NextResponse(null, { status: 204 });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  void params;
  return new NextResponse(null, { status: 204 });
}
