import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The app reports an ask was shown, or opened (consent asks). */
export const POST = proxyRoute("POST", "/v2/user/asks/:id", { body: "json", noStore: true });
