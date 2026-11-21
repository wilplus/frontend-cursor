import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** PUT and DELETE /v2/experiments/prompts/<id>. */
export const PUT = proxyRoute("PUT", "/v2/experiments/prompts/:promptId", { body: "json", noStore: true });
export const DELETE = proxyRoute("DELETE", "/v2/experiments/prompts/:promptId", { noStore: true });
