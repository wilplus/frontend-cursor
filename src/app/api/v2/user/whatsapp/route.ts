import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The speaker's WhatsApp number for "the feedback from your coach is in". */
export const GET = proxyRoute("GET", "/v2/user/whatsapp", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/user/whatsapp", { body: "json" });
export const DELETE = proxyRoute("DELETE", "/v2/user/whatsapp");
