import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The speaker opened the app: the WhatsApp ask that waited for this visit
 *  is made when due (backend N294 item 8, N295), and the one ask for the bar
 *  at the top of the chat comes back (N391; NoticeBar.tsx). 200 {ask}. */
export const POST = proxyRoute("POST", "/v2/user/lounge/visit", { body: "json", noStore: true });
