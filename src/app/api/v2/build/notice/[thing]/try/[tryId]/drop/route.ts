import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** "Go back": drop the silent try (backend N647 item 3). */
export const POST = proxyRoute("POST", "/v2/build/notice/:thing/try/:tryId/drop", { body: "json", noStore: true });
