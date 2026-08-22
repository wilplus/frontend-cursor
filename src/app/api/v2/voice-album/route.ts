import { callBackend } from "@/app/api/_lib/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  return callBackend("/v2/voice-album", { method: "GET" });
}
