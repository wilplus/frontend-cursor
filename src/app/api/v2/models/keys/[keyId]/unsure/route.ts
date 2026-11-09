import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Send the questions it wasn't sure about to its teachers": {on} in and
 *  out (backend N563 item 4, N566 item 9). */
export const POST = proxyRoute("POST", "/v2/models/keys/:keyId/unsure", { body: "json", noStore: true });
