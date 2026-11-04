import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Send a Take to the people ticked, each in the speaker's chat with them (backend N470, N472). */
export const POST = proxyRoute("POST", "/v2/user/takes/:takeSessionId/send", { body: "json" });
