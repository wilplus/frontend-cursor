import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The website chat (backend N567, N591): the widget's first read, no
 *  sign-in. {name, writes}: how a visitor may write, from the host's recipe;
 *  404 for a wrong, replaced or switched-off link. */
export const GET = proxyRoute("GET", "/v2/chats/widget/:token", { noStore: true, widgetGuest: "public" });
