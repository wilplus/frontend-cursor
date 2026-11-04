import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Undo, inside the five seconds: the answer is taken back (N441). */
export const POST = proxyRoute("POST", "/v2/take-matches/:matchId/undo");
