import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The AI version of your voice (founder lock 2026-10-12, N71): POST enters
   the voice Exercise lane and starts the clip once; GET reads its state. */
export const GET = proxyRoute("GET", "/v2/user/confidence-practice/:practiceId/ai-voice", { noStore: true });
export const POST = proxyRoute("POST", "/v2/user/confidence-practice/:practiceId/ai-voice", { body: "json", noStore: true });
