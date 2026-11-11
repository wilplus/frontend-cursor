import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A model started from its blocks on the AI models page (backend N636 item 7):
 *  {question, answers, gives?, base?} → {model_id, status, screen}, as
 *  "Start your own". 400 NOT_READY / NOT_READY_YET; 404 below `ai_models`. */
export const POST = proxyRoute("POST", "/v2/models/setup/blocks", { body: "json", noStore: true });
