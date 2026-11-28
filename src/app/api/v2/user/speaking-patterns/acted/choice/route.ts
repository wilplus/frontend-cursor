import { type NextRequest } from "next/server";
import { callBackend, relayLenient } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const response = relayLenient();

/** The moment kept from a longer acted take (backend N711). */
export async function POST(request: NextRequest) {
  const upstream = await callBackend("/v2/user/speaking-patterns/acted/choice", {
    method: "POST",
    body: await request.text() || "{}",
    headers: { "Content-Type": "application/json" },
    relay: response,
  });
  upstream.headers.set("Cache-Control", "no-store");
  return upstream;
}
