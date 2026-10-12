import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 8 (founder 2026-10-01, C5-b): this coach's pending block picks, audio
// only. Dark (404) until COACH_BLOCK_PICK_ENABLED.
export const GET = proxyRoute("GET", "/v2/coach/block-picks");
