import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const POST = proxyRoute("POST", "/v2/user/lounge/moment/:snippetId/ai-voice", { body: "json", noStore: true });
