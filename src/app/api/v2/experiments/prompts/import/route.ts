import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** POST /v2/experiments/prompts/import. Copies the shipped prompt file into the caller's library. */
export const POST = proxyRoute("POST", "/v2/experiments/prompts/import", { body: "json", noStore: true });
