import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

// The coach's answer on the speaker's chosen practice recording (founder
// 2026-10-05, Q6). The backend keeps it behind the blind gate.
export const PUT = proxyRoute("PUT", "/v2/coach/sessions/:sessionId/snippets/:snippetId/practice-judgement", { body: "json" });
