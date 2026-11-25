import "server-only";
import { relayAudio } from "@/app/api/_lib/backend";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const GET = proxyRoute("GET", "/v2/user/confidence-practice/:practiceId/ai-voice/chat/:retryId/audio",
  { relay: relayAudio, range: true, noStore: true });
