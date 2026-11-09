import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A teacher's answer to one example (backend N566 item 7): {step, answer} in;
 *  {saved, note, follow, trust} out, and never the machine's read (Never 2). */
export const POST = proxyRoute("POST", "/v2/models/:modelId/examples/:exampleId/answer", { body: "json", noStore: true });
