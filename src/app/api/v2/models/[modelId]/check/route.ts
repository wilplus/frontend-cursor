import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The owner's check of a model (backend N616 item 23): ten examples it was
 *  not fitted on, its guess first. GET reads it; POST {example_id, keep} or
 *  {example_id, keep: false, answer} keeps or fixes one. Owner only. */
export const GET = proxyRoute("GET", "/v2/models/:modelId/check", { noStore: true });
export const POST = proxyRoute("POST", "/v2/models/:modelId/check", { body: "json", noStore: true });
