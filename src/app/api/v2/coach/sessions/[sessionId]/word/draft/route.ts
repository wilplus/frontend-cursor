import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 7 (founder 2026-10-01, C5-a): a draft of the Take word, after every
// moment of the Take is judged. Dark (404) until COACH_WORD_PAIRS_ENABLED.
export const POST = proxyRoute("POST", "/v2/coach/sessions/:sessionId/word/draft", { body: "json" });
