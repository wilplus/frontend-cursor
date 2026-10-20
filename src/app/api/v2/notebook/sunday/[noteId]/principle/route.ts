import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The Sunday note: Add principle (to the Life Panel) or Not now. */
export const POST = proxyRoute("POST", "/v2/notebook/sunday/:noteId/principle", { body: "json" });
