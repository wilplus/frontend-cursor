import type { NextRequest } from "next/server";
import { uploadRoute } from "@/app/api/v2/chats/chatUpload";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** Existing data, multipart `file` (a CSV or a JSON file), read and checked
 *  (backend N566 item 4). Nothing counts until "Upload it" with the tick. */
const upload = uploadRoute("POST", (p) => `/v2/models/${encodeURIComponent(p.modelId)}/setup/data`);

/** The data step's own answer ("Use this data", "I don't have any"), JSON:
 *  this folder shadows `[step]` for the step named "data", so its answer
 *  comes here too and goes on as JSON, never read as an upload (the
 *  founder's trial: "Invalid multipart payload."). */
const answer = proxyRoute("POST", "/v2/models/:modelId/setup/data", { body: "json", noStore: true });

export async function POST(req: NextRequest, context: { params: Record<string, string> }) {
  const json = (req.headers.get("content-type") ?? "").includes("application/json");
  return json ? answer(req, context) : upload(req, context);
}
