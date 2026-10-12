import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Relay a take share choice. */
export const PUT = proxyRoute("PUT", "/v2/user/takes/:takeSessionId/share", { body: "json" });
