import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** One step's answer, then the next step (backend N528 item 4, N570). */
export const POST = proxyRoute("POST", "/v2/models/:modelId/setup/:step", { body: "json", noStore: true });
