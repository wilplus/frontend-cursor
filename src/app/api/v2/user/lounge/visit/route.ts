import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The speaker opened the app: a settings ask that waited for this visit
 *  (WhatsApp, then the home screen) is written, one at a time, never after a
 *  Take (founder 2026-10-31, backend N294 item 8, N295;
 *  services/after_take.py `visit`). 200 {rows}. */
export const POST = proxyRoute("POST", "/v2/user/lounge/visit", { body: "json", noStore: true });
