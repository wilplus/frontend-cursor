import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** A silent try on one noticed thing (backend N647 item 3, founder only):
 *  GET -> {thing, try, can_use}; POST {direction: "more" | "fewer"} starts it. */
export const GET = proxyRoute("GET", "/v2/build/notice/:thing/try", { noStore: true });
export const POST = proxyRoute("POST", "/v2/build/notice/:thing/try", { body: "json", noStore: true });
