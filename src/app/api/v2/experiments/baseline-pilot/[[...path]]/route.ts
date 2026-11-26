import { NextRequest } from "next/server";
import { pilotError, relayBaselinePilot, type PilotRouteContext } from "@/app/api/_lib/baselinePilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function relay(req: NextRequest, { params }: PilotRouteContext) {
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return pilotError(404, "NOT_FOUND");
  return relayBaselinePilot(req, params.path ?? []);
}

export const GET = relay;
export const POST = relay;
export const PUT = relay;
