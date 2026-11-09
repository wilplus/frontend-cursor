import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The owner's answer to one of their first 10: {step, answer} (backend N570 item 4). */
export const POST = proxyRoute("POST", "/v2/models/:modelId/setup/first-ten/:exampleId", { body: "json", noStore: true });
