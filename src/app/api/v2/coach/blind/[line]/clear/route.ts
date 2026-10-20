import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// The founder's ⋯ on a blind line of the queue (2026-10-20): what waits on
// it is cleared for the week. Founder-only upstream.
export const POST = proxyRoute("POST", "/v2/coach/blind/:line/clear", { body: "json" });
