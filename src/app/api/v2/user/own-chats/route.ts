import { proxyRoute } from "@/app/api/_lib/proxyRoute";

/* A person's own chats (backend N700): the list, and a new one. The backend
   owns validation and tenancy; this BFF only relays. */

export const GET = proxyRoute("GET", "/v2/user/own-chats", { noStore: true });

export const POST = proxyRoute("POST", "/v2/user/own-chats", { body: "json", noStore: true });
