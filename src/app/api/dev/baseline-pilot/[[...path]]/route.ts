import { NextRequest } from "next/server";
import { pilotError, relayBaselinePilot, type PilotRouteContext } from "@/app/api/_lib/baselinePilot";
import { localBaselineAvailable, localBaselineToken, loopbackHost } from "@/app/api/_lib/localBaseline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function relay(req: NextRequest, { params }: PilotRouteContext) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") ?? "";
  // NextURL normalizes 127.0.0.1 to localhost; the browser's Origin follows Host.
  if (!localBaselineAvailable() || !loopbackHost(host) || (origin && origin !== `${req.nextUrl.protocol}//${host}`) ||
      req.headers.get("sec-fetch-site") === "cross-site") return pilotError(404, "NOT_FOUND");
  const token = await localBaselineToken();
  if (!token) return pilotError(503, "PILOT_UNAVAILABLE");
  return relayBaselinePilot(req, params.path ?? [], token);
}

export const GET = relay;
export const POST = relay;
export const PUT = relay;
