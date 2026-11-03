import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* The iPhone app's address for Apple's push service (backend N385,
   services/push_devices.py): kept on POST, forgotten on DELETE (sign-out). */
export const POST = proxyRoute("POST", "/v2/user/push-device", { body: "json", noStore: true });
export const DELETE = proxyRoute("DELETE", "/v2/user/push-device", { body: "json", noStore: true });
