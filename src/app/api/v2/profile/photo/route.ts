import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayFile, uploadRoute } from "../../chats/chatUpload";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Your profile's photo (backend N366): shown, set (multipart `file`) or
 *  taken away. */
export const GET = proxyRoute("GET", "/v2/profile/photo", { relay: relayFile, noStore: true });
export const PUT = uploadRoute("PUT", () => "/v2/profile/photo");
export const DELETE = proxyRoute("DELETE", "/v2/profile/photo", { noStore: true });
