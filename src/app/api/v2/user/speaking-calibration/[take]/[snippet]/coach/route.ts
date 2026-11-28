import { type NextRequest, NextResponse } from "next/server";
import { callBackend, relayAudio, relayLenient } from "@/app/api/_lib/backend";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 60;

const response = relayLenient();
const relay = (upstream: Response) =>
  upstream.ok && upstream.headers.get("content-type")?.startsWith("audio/")
    ? relayAudio(upstream) : response(upstream);
const json = proxyRoute("POST", "/v2/user/speaking-calibration/:take/:snippet/coach", {
  body: "json", noStore: true, relay,
});

export async function POST(request: NextRequest, context: { params: { take: string; snippet: string } }) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return json(request, context);
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ code: "INVALID_AUDIO" }, { status: 400 });
  }
  const { take, snippet } = context.params;
  return callBackend(`/v2/user/speaking-calibration/${encodeURIComponent(take)}/${encodeURIComponent(snippet)}/coach`, {
    method: "POST", body: form, signal: AbortSignal.timeout(55_000), relay,
  });
}
