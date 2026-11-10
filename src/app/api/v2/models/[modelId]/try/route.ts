import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Try it", in text (backend N566 item 8, MOD-40, MOD-45): {message} in,
 *  {sub, text, sure, mark?} out. The backend runs it under the caller's own
 *  processing authority. */
export const POST = proxyRoute("POST", "/v2/models/:modelId/try", { body: "json", noStore: true });
