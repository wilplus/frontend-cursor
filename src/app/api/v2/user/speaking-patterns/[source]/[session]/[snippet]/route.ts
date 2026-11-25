import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";
const path = "/v2/user/speaking-patterns/:source/:session/:snippet";
export const GET = proxyRoute("GET", path, { noStore: true });
export const POST = proxyRoute("POST", path, { body: "json", noStore: true });
export const PUT = proxyRoute("PUT", path, { body: "json", noStore: true });
export const DELETE = proxyRoute("DELETE", path, { body: "json", noStore: true });
