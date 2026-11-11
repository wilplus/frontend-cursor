import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The answers a model's question suggests (backend N646): {question} ->
 *  {sets: [[a, b, c], ...]}, the first set inferred from the question. */
export const POST = proxyRoute("POST", "/v2/models/setup/answers", { body: "json", noStore: true });
