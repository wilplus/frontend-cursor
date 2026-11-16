import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A plan for the draft. The backend writes nothing. */
export const POST = proxyRoute("POST", "/v2/coaches/speaking-coach/preview", { body: "json", noStore: true });
