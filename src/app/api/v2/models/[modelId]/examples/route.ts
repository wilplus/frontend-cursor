import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** An example a teacher adds, in words: {text | transcript, step?, answer?}
 *  in, {example_id, note} out (backend N563 item 4, MOD-21). */
export const POST = proxyRoute("POST", "/v2/models/:modelId/examples", { body: "json", noStore: true });
