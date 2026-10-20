import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The question before the first note, written into the Lounge. */
export const POST = proxyRoute("POST", "/v2/notebook/ask", { body: "json" });
