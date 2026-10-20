import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// The founder's Delete on a speaker's row of the queue (2026-10-20): their
// waiting moments leave every coach's queue. Founder-only upstream.
export const POST = proxyRoute("POST", "/v2/coach/queue/moments/close", { body: "json" });
