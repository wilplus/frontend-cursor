import { proxyRoute } from "@/app/api/_lib/proxyRoute";

/* Update a project's deck, inside the same project (backend N257). The
   backend decides everything; this only forwards. */

export const PUT = proxyRoute("PUT", "/v2/projects/:projectId/deck", { body: "json" });
