import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The tempo step's stretch for one Take (backend N162, N166). `one=1`, the
 *  One thing walk's ask, is passed on: the backend then makes no topic call
 *  (C-TEMPO). Nothing else of the query is. */
export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string; takeId: string } },
): Promise<NextResponse> {
  const one = req.nextUrl.searchParams.get("one") === "1" ? "?one=1" : "";
  const response = await callBackend(
    `/v2/explore/arc/${encodeURIComponent(params.arcId)}/review/tempo/${encodeURIComponent(params.takeId)}${one}`,
    { method: "GET" },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** The tempo game as played, kept for Will (backend N166 step 4). */
export const POST = proxyRoute("POST", "/v2/explore/arc/:arcId/review/tempo/:takeId", { body: "json" });
