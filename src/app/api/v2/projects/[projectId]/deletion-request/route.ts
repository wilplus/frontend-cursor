import { proxyRoute } from "@/app/api/_lib/proxyRoute";

/* Ask for one project to be deleted, or cancel that request (P1, N8). The
   backend decides everything; this only forwards. */

export const POST = proxyRoute("POST", "/v2/projects/:projectId/deletion-request", { body: "text" });

export const DELETE = proxyRoute("DELETE", "/v2/projects/:projectId/deletion-request");
