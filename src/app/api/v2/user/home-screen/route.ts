import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The person opened the app from their home screen (shown on their admin profile). */
export const PUT = proxyRoute("PUT", "/v2/user/home-screen", { noStore: true });
