import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Use it": make the tried setting live (backend N647 item 3); 404 while
 *  the backend's switch is off. */
export const POST = proxyRoute("POST", "/v2/build/notice/:thing/try/:tryId/use", { body: "json", noStore: true });
