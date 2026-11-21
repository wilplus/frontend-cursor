import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** GET and POST /v2/experiments/prompts. */
export const GET = proxyRoute("GET", "/v2/experiments/prompts", { noStore: true });
export const POST = proxyRoute("POST", "/v2/experiments/prompts", { body: "json", noStore: true });
