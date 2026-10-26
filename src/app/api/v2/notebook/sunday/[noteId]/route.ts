import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The Sunday note's lens as it stands (backend N158 L3 to L8). */
export const GET = proxyRoute("GET", "/v2/notebook/sunday/:noteId", { noStore: true });
