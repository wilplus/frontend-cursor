import { NextRequest, NextResponse } from "next/server";
import { callBackend, type Relay } from "@/app/api/_lib/backend";
import { proxyResponse } from "@/app/api/proxyResponse";

export const runtime = "nodejs";

/** A file download keeps its type and filename. An error stays JSON, so a
 *  403 and a 404 are unchanged. */
const relayExport: Relay = async (upstream) => {
  if (!upstream.ok) return proxyResponse(upstream);
  const type = upstream.headers.get("content-type") || "application/octet-stream";
  const named = upstream.headers.get("content-disposition");
  const csv = type.includes("csv") || type.includes("text/plain");
  const disposition = named || `attachment; filename="my-sessions.${csv ? "csv" : "json"}"`;
  const out = new NextResponse(upstream.body, { status: upstream.status });
  out.headers.set("Content-Type", type);
  out.headers.set("Content-Disposition", disposition);
  out.headers.set("Cache-Control", "no-store");
  return out;
};

/** GET /v2/experiments/export?format=csv|json&audience=self|researcher. */
export async function GET(req: NextRequest) {
  return callBackend(`/v2/experiments/export${req.nextUrl.search}`, { method: "GET", relay: relayExport });
}
