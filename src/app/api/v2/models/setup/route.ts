import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Start your own" (backend N528 item 4, N566 item 2; routes/v2/model_setup.py):
 *  a new draft, {model_id, status, screen}. 404 below ring 6 (`ai_models`). */
export const POST = proxyRoute("POST", "/v2/models/setup", { body: "json", noStore: true });
