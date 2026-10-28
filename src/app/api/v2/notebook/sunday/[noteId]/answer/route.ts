import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** One tap of the Sunday note's lens, or Not now under the case (N158). */
export const POST = proxyRoute("POST", "/v2/notebook/sunday/:noteId/answer", { body: "json" });
