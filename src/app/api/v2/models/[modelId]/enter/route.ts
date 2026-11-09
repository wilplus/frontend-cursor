import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "This is my field" at the door (backend N528 item 2): {joined}. */
export const POST = proxyRoute("POST", "/v2/models/:modelId/enter", { body: "json", noStore: true });
