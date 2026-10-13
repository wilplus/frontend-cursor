import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

export const POST = proxyRoute("POST", "/v2/user/confidence-practice/:practiceId/ai-voice/play", { body: "json" });
