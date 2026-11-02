import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEVELS = new Set(["high", "middle", "low"]);

/** Other speakers' moments to judge in the walk of one Take (`?take=`,
 *  N119): one per level, three speakers, the listener's communities first in
 *  each level, then the training corpus; `?level=` the One thing walk's one
 *  moment of that machine level (N309). Audio only. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const take = req.nextUrl.searchParams.get("take");
  const level = req.nextUrl.searchParams.get("level");
  const params = new URLSearchParams();
  if (take && UUID.test(take)) params.set("take", take);
  if (level && LEVELS.has(level)) params.set("level", level);
  const query = params.toString() ? `?${params.toString()}` : "";
  return callBackend(`/v2/user/communities/queue${query}`, { method: "GET" });
}
