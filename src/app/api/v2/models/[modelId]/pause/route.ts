import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Pause, per model, in the queue (backend N563 item 1): {paused} in,
 *  {paused} out. */
export const POST = proxyRoute("POST", "/v2/models/:modelId/pause", { body: "json", noStore: true });
