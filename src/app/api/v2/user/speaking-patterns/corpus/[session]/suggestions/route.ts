import { type NextRequest } from "next/server";
import { callBackend, relayLenient } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const response = relayLenient();

/** VV moment picker suggestions for one corpus recording (backend N710).
 *  The first call measures every clip, so the upstream wait stays under the
 *  function limit, the same 55s as an acted upload. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { session: string } },
) {
  const upstream = await callBackend(
    `/v2/user/speaking-patterns/corpus/${encodeURIComponent(params.session)}/suggestions`,
    { method: "GET", relay: response, signal: AbortSignal.timeout(55_000) },
  );
  upstream.headers.set("Cache-Control", "no-store");
  return upstream;
}
