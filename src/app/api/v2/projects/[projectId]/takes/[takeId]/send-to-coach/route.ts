import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const POST = proxyRoute("POST", "/v2/projects/:projectId/takes/:takeId/send-to-coach");
