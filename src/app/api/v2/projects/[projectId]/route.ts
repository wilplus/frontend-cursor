import { proxyRoute } from "@/app/api/_lib/proxyRoute";

/* Rename one owner-authorized project. The backend owns validation and
   tenancy; this BFF only relays the authenticated JSON request. */

export const PATCH = proxyRoute("PATCH", "/v2/projects/:projectId", {
  body: "json",
  noStore: true,
});
