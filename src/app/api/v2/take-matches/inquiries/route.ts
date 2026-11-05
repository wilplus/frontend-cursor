import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The asking chats in the list: a matched Take that reached me (backend N485, #1712). */
export const GET = proxyRoute("GET", "/v2/take-matches/inquiries", { noStore: true });
