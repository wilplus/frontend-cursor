import { proxyRoute } from "@/app/api/_lib/proxyRoute";

/* Archive one project, or bring it back (N14). The backend decides
   everything; this only forwards. */

export const POST = proxyRoute("POST", "/v2/projects/:projectId/archive");

export const DELETE = proxyRoute("DELETE", "/v2/projects/:projectId/archive");
