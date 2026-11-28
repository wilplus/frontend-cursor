import { type NextRequest } from "next/server";
import { callBackend, relayLenient } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const response = relayLenient();

/** One click: this clip's speaker says the corrected version (backend N712). */
export async function POST(
  request: NextRequest,
  { params }: { params: { session: string; snippet: string } },
) {
  const upstream = await callBackend(
    `/v2/user/speaking-patterns/corpus/${encodeURIComponent(params.session)}/${encodeURIComponent(params.snippet)}/in-their-voice`,
    {
      method: "POST",
      body: await request.text() || "{}",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(55_000),
      relay: response,
    },
  );
  upstream.headers.set("Cache-Control", "no-store");
  return upstream;
}
